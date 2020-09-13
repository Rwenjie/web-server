import { getLogger } from "log4js";
import sharp, { Sharp } from "sharp";
import mime from "mime-types";
import { BadDataError } from "../errors";
import LocalFileStore from "../LocalFileStore";
import { MediaSaveRequest, Params } from "../WebFileService";
import { crop } from "./param-processor";

interface ImageInfo {
	buffer: Buffer;
	type: string;
}

const logger = getLogger("Image");

/**
 * 能够处理的图片格式，不支持 WebP 作为输入。
 */
const INPUT_FORMATS = ["jpg", "png", "gif", "svg"];

async function preprocess(request: MediaSaveRequest): Promise<ImageInfo> {
	const { buffer, parameters } = request;

	let type = mime.extension(request.mimetype);
	if (!type) {
		throw new BadDataError(`不支持的MimeType: ${type}`);
	}

	let image: Sharp | null = null;
	if (parameters.crop) {
		image = crop(sharp(buffer), parameters.crop);
	}

	if (type === "bmp") {
		type = "png";
		image = (image || sharp(buffer)).png();
	}

	if (INPUT_FORMATS.indexOf(type) < 0) {
		throw new BadDataError(`不支持的图片格式：${type}`);
	}

	return { type, buffer: image ? await image.toBuffer() : buffer };
}

export default class RasterImageService {

	private readonly store: LocalFileStore;

	constructor(store: LocalFileStore) {
		this.store = store;
	}

	async save(request: MediaSaveRequest) {
		const info = await preprocess(request);
		const { buffer, type } = info;

		const { name, createNew } = await this.store.save(buffer, type, request.name);

		if (createNew) {
			await this.buildCache(name, info, request.parameters);
		}

		return name;
	}

	async buildCache(name: string, info: ImageInfo, parameters: Params) {

	}
}