import crypto from "crypto";
import path from "path";
import pathlib from "path";
import { Context, ExtendableContext } from "koa";
import fs from "fs-extra";
import mime from "mime-types";
import sendFileRange, { FileRangeReader } from "./send-range";

interface VideoDownloadContext extends ExtendableContext {
	params: { name: string };
}

export async function downloadVideo(directory: string, ctx: VideoDownloadContext) {
	const name = path.basename(ctx.params.name);
	const fullname = path.join(directory, name);

	try {
		const stats = await fs.stat(fullname);
		ctx.set("Last-Modified", stats.mtime.toUTCString());
		ctx.set("Cache-Control", "max-age=31536000");
		ctx.type = pathlib.extname(name);

		return sendFileRange(ctx, new FileRangeReader(fullname, stats.size));
	} catch (e) {
		if (e.code !== "ENOENT") throw e;
	}
}

export async function uploadVideo(directory: string, ctx: Context) {
	const { buffer, mimetype } = ctx.file;

	const hash = crypto
		.createHash("sha3-256")
		.update(buffer)
		.digest("hex");

	const name = hash + "." + mime.extension(mimetype);
	try {
		await fs.writeFile(path.join(directory, name), buffer, { flag: "wx" });
	} catch (e) {
		if (e.code !== "EEXIST") throw e;
	}

	ctx.status = 201;
	ctx.set("Location", `${ctx.path}/${name}`);
}
