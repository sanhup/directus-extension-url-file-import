import { defineOperationApi } from '@directus/extensions-sdk';
import { ServiceUnavailableError } from '@directus/errors';
import { useEnv } from '@directus/env';
// import Busboy from 'busboy'
import { Readable } from 'stream'
import axios, { AxiosResponse } from 'axios'
import url from 'url';
import path from 'path';
import zlib from 'node:zlib';

const env = useEnv();

type Options = {
	importUrl: string;
	method: string;
	body: Record<string, any> | string | null;
	headers?: { header: string; value: string }[] | null;
};

export default defineOperationApi<Options>({
	id: 'url-file-import',
	handler: async ({ importUrl, method, destinationFolder, body, headers }, { services, accountability, getSchema, logger}) => {

		const { FilesService } = services;

		const filesService = new FilesService({
			schema: await getSchema(),
			accountability: accountability
		  });

		const customHeaders =
		  headers?.reduce(
			  (acc, { header, value }) => {
				  acc[header] = value;
				  return acc;
			  },
			  {} as Record<string, string>,
		  ) ?? {};

		let fileResponse;

		try {
			fileResponse = await axios.get<Readable>(importUrl, {
				method: method,
				data: body,
				headers: customHeaders,
				responseType: 'stream',
				// decompress: false, // if false also use decompress function below.
			});
		}catch (error: any) {
			logger.warn(`Couldn't fetch file from URL "${importUrl}"${error.message ? `: ${error.message}` : ''}`);
			logger.trace(error);

			throw new ServiceUnavailableError({
				service: 'external-file',
				reason: `Couldn't fetch file from URL "${importUrl}"`,
			});
		}

		const parsedURL = url.parse(fileResponse.request.res.responseUrl);
		const filename = decodeURI(path.basename(parsedURL.pathname as string));

		const storage = (env['STORAGE_LOCATIONS'] as string).split(',')[0]!.trim();

		const payload = {
			filename_download: filename,
			storage: storage,
			type: fileResponse.headers['content-type'],
			title: filename,
			folder: destinationFolder,
			...(body || {}),
		};

		// not sure why the filesServer handles decompression by itself. Disabled it ()
		// const decompressed = decompressResponse(fileResponse.data, fileResponse.headers)
		return await filesService.uploadOne(fileResponse.data, payload, payload.id);

	},



});

function decompressResponse(stream: Readable, headers: AxiosResponse['headers']) {
	const contentEncoding = (headers['content-encoding'] || '').toLowerCase();

	if (!['gzip', 'deflate', 'br'].includes(contentEncoding)) {
		return stream;
	}

	let isEmpty = true;

	const checker = new TransformStream({
		transform(data, _encoding, callback) {
			if (isEmpty === false) {
				callback(null, data);
				return;
			}

			isEmpty = false;

			handleContentEncoding(data);

			callback(null, data);
		},

		flush(callback) {
			callback();
		},
	});

	const finalStream = new PassThroughStream({
		autoDestroy: false,
		destroy(error, callback) {
			stream.destroy();

			callback(error);
		},
	});

	stream.pipe(checker);

	return finalStream;

	function handleContentEncoding(data: any) {
		let decompressStream;

		if (contentEncoding === 'br') {
			decompressStream = zlib.createBrotliDecompress();
		} else if (contentEncoding === 'deflate' && isDeflateAlgorithm(data)) {
			decompressStream = zlib.createInflateRaw();
		} else {
			decompressStream = zlib.createUnzip();
		}

		decompressStream.once('error', (error) => {
			if (isEmpty && !stream.readable) {
				finalStream.end();
				return;
			}

			finalStream.destroy(error);
		});

		checker.pipe(decompressStream).pipe(finalStream);
	}

	function isDeflateAlgorithm(data: any) {
		const DEFLATE_ALGORITHM_HEADER = 0x08;

		return data.length > 0 && (data[0] & DEFLATE_ALGORITHM_HEADER) === 0;
	}
}
