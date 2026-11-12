import { Platform, Share } from 'react-native';
import api from '../services/api';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { csvFilename, countCsvRows, deliverCsv, exportReports } from '../services/exportReports';

jest.mock('../services/api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));
jest.mock('expo-file-system/legacy', () => ({
  cacheDirectory: 'file:///cache/',
  EncodingType: { UTF8: 'utf8' },
  writeAsStringAsync: jest.fn(() => Promise.resolve()),
}));
jest.mock('expo-sharing', () => ({
  isAvailableAsync: jest.fn(() => Promise.resolve(true)),
  shareAsync: jest.fn(() => Promise.resolve()),
}));

describe('exportReports', () => {
  const originalOS = Platform.OS;

  afterEach(() => {
    Platform.OS = originalOS;
    jest.restoreAllMocks();
    delete global.document;
    delete global.URL.createObjectURL;
    delete global.URL.revokeObjectURL;
  });

  it('el nombre del archivo lleva la fecha local AAAA-MM-DD', () => {
    expect(csvFilename(new Date(2026, 0, 5))).toBe('reportes-2026-01-05.csv');
    expect(csvFilename(new Date(2026, 10, 25))).toBe('reportes-2026-11-25.csv');
  });

  it('cuenta solo las filas de datos, ignorando BOM, cabecera y líneas vacías', () => {
    expect(countCsvRows('﻿id,desc\n')).toBe(0);
    expect(countCsvRows('id,desc\n1,a\n2,b\r\n\n')).toBe(2);
    expect(countCsvRows('')).toBe(0);
    expect(countCsvRows(undefined)).toBe(0);
  });

  it('no corta una fila por saltos de línea dentro de un campo entre comillas', () => {
    expect(countCsvRows('id,desc\n1,"línea 1\nlínea 2\r\nlínea 3"\n2,b\n')).toBe(2);
    expect(countCsvRows('id,desc\n1,"con ""comillas""\ny salto"\n')).toBe(1);
  });

  describe('en móvil', () => {
    beforeEach(() => {
      FileSystem.writeAsStringAsync.mockClear();
      Sharing.shareAsync.mockClear();
      Sharing.isAvailableAsync.mockResolvedValue(true);
    });

    it('guarda el CSV (con BOM) como archivo en la caché y comparte el archivo', async () => {
      const spy = jest.spyOn(Share, 'share');

      const result = await deliverCsv('id\n1\n', 'reportes-2026-11-06.csv');

      expect(FileSystem.writeAsStringAsync).toHaveBeenCalledWith(
        'file:///cache/reportes-2026-11-06.csv', '﻿id\n1\n', { encoding: 'utf8' },
      );
      expect(Sharing.shareAsync).toHaveBeenCalledWith('file:///cache/reportes-2026-11-06.csv', expect.objectContaining({
        mimeType: 'text/csv',
        dialogTitle: 'reportes-2026-11-06.csv',
      }));
      expect(spy).not.toHaveBeenCalled();
      expect(result).toEqual({ shared: true });
    });

    describe('si el dispositivo no puede compartir archivos', () => {
      beforeEach(() => { Sharing.isAvailableAsync.mockResolvedValue(false); });

      it('comparte el CSV como texto con Share.share', async () => {
        jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

        const result = await deliverCsv('id\n1\n', 'reportes-2026-11-06.csv');

        expect(Share.share).toHaveBeenCalledWith({ message: 'id\n1\n', title: 'reportes-2026-11-06.csv' });
        expect(FileSystem.writeAsStringAsync).not.toHaveBeenCalled();
        expect(result).toEqual({ shared: true });
      });

      it('si el usuario cierra la hoja de compartir no cuenta como exportado', async () => {
        jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.dismissedAction });

        expect(await deliverCsv('id\n1\n', 'x.csv')).toEqual({ shared: false });
      });
    });
  });

  describe('en web', () => {
    const setupWeb = () => {
      Platform.OS = 'web';
      const link = { click: jest.fn() };
      global.document = {
        createElement: jest.fn(() => link),
        body: { appendChild: jest.fn(), removeChild: jest.fn() },
      };
      global.URL.createObjectURL = jest.fn(() => 'blob:csv');
      global.URL.revokeObjectURL = jest.fn();
      return link;
    };

    it('descarga con un Blob y un enlace temporal, y libera la URL', async () => {
      const link = setupWeb();

      const result = await deliverCsv('id\n1\n', 'reportes-2026-11-06.csv');

      const blob = global.URL.createObjectURL.mock.calls[0][0];
      expect(blob.type).toBe('text/csv;charset=utf-8');
      expect(link.href).toBe('blob:csv');
      expect(link.download).toBe('reportes-2026-11-06.csv');
      expect(link.click).toHaveBeenCalledTimes(1);
      expect(global.document.body.removeChild).toHaveBeenCalledWith(link);
      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
      expect(result).toEqual({ shared: true });
    });

    it('libera la URL aunque el clic falle', async () => {
      const link = setupWeb();
      link.click.mockImplementation(() => { throw new Error('boom'); });

      await expect(deliverCsv('id\n1\n', 'x.csv')).rejects.toThrow('boom');

      expect(global.URL.revokeObjectURL).toHaveBeenCalledWith('blob:csv');
    });

    it('no usa Share.share', async () => {
      setupWeb();
      const spy = jest.spyOn(Share, 'share');

      await deliverCsv('id\n1\n', 'x.csv');

      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('exportReports', () => {
    it('pide el CSV con los filtros como texto y lo entrega', async () => {
      api.get.mockResolvedValue({ data: 'id\n1\n2\n' });
      jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });

      const result = await exportReports({ validation_status: 'pendiente', search: 'x' });

      expect(api.get).toHaveBeenCalledWith('/admin/reports/export', {
        params: { validation_status: 'pendiente', search: 'x' },
        responseType: 'text',
      });
      expect(result).toEqual({ empty: false, rows: 2, shared: true });
    });

    it('sin filas devuelve empty y no entrega nada', async () => {
      api.get.mockResolvedValue({ data: '﻿id\n' });
      const spy = jest.spyOn(Share, 'share');

      expect(await exportReports({})).toEqual({ empty: true, rows: 0, shared: false });
      expect(spy).not.toHaveBeenCalled();
    });

    it('propaga el error de la API', async () => {
      api.get.mockRejectedValue(new Error('fail'));

      await expect(exportReports({})).rejects.toThrow('fail');
    });
  });
});
