import bytes from "bytes";
import fs from "fs-extra";
import { promisify } from "util";
import { brotliCompress, gzip, InputType } from "zlib";
import { isMainThread, parentPort, Worker, workerData } from "worker_threads";
import os from "os";
import globby from "globby";


const brotliCompressAsync = promisify<InputType, Buffer>(brotliCompress);
const gzipCompressAsync = promisify<InputType, Buffer>(gzip);

interface FileInfo {
	size: number;
	path: string;
}

/**
 * 使用 bortli 和 gzip 算法预压缩一些静态资源，分别生成文件名尾部附加 .br 和 .gz 的压缩文件。
 * 该模块应当在静态资源打包完成后或服务器启动前调用一次，然后配合 Koa-Send 之类的中间件自动发送压缩的资源。
 *
 * [注意] WOFF2 字体已经是Brotli压缩的，如果存在则不需要压缩字体文件
 *
 * @param resources 要压缩的文件列表
 * @param period 小于此大小（字节）的不压缩
 */
export async function precompress(resources: string[], period: number) {
	const infos: FileInfo[] = [];
	let originSize = 0;

	for (const file of resources) {
		const size = (await fs.stat(file)).size;
		if (size < period) {
			continue;
		}
		originSize += size;
		infos.push({ size, path: file });
	}

	// 计算一下分配几个线程，每个线程至少处理 4M 的文件，当然不能超出CPU个数
	let threads = Math.round(originSize / bytes("4M"));
	threads = Math.min(threads, os.cpus().length);

	if (threads < 2) {
		await doWork(resources);
	} else {
		const tasks = partition(infos, threads);
		await Promise.all(tasks.map(startWorkerThread));
	}
}

/**
 * 按大小均分文件，实际情况下分得还是比较均匀，但不一定是最优解。
 * 求最优解是 3-Partition 问题，该问题是NP难题。对于实际情况来说，有点误差并不会造成多大影响。
 *
 * @param infos 待均分的文件集合
 * @param count 需要均分成多少份？
 * @return 均分后的结果
 */
function partition(infos: FileInfo[], count: number) {

	interface Package {
		size: number;
		files: string[];
	}

	infos.sort((a, b) => b.size - a.size);

	const packages: Package[] = [];
	for (let i = count; i > 0; i--) {
		packages.push({ size: 0, files: [] });
	}

	for (const res of infos) {
		const m = packages[0];
		const size = (m.size += res.size);
		m.files.push(res.path);

		if (size > packages[1].size) {
			let i = packages.findIndex((t) => t.size > size);
			if (i === -1) {
				i = packages.length;
			}
			if (i > 0) {
				packages.shift();
				packages.splice(i - 1, 0, m);
			}
		}
	}
	return packages.map((t) => t.files);
}

/**
 * 启动 Worker 线程来压缩指定数组中的文件。
 *
 * @param tasks 文件数组
 * @return 在所有文件压缩完后resolve的Promise，如果Worker线程出现异常则会reject.
 */
function startWorkerThread(tasks: string[]) {
	return new Promise<void>((resolve, reject) => {
		const worker = new Worker(__filename, {
			workerData: tasks,
		});
		worker.on("exit", (code) => {
			if (code !== 0) reject(new Error(`Worker stopped with exit code ${code}`));
		});
		worker.on("error", reject);
		worker.on("message", resolve);
	});
}

/**
 * 分别使用 brotli 和 gzip 算法压缩文件。
 *
 * @param files 文件数组
 */
async function doWork(files: string[]) {
	for (const file of files) {
		const data = await fs.readFile(file);
		await fs.writeFile(file + ".gz", await gzipCompressAsync(data));
		await fs.writeFile(file + ".br", await brotliCompressAsync(data));
	}
}

/**
 * 便捷方法，搜索指定目录下可压缩的资源并压缩。
 * 压缩的文件附加 .gz 和 .br 后缀，小于 1KB 的资源不压缩。
 *
 * @param path_ 静态资源目录
 */
export function compressStaticDirectory(path_: string) {
	const pattern = [path_ + "/**/*.{js,css,svg,html,xml}"];
	return globby(pattern).then((files) => precompress(files, 1024));
}

if (!isMainThread) {
	// @ts-ignore 在 Worker 线程中 parentPort 不为 null
	doWork(workerData).then((result) => parentPort.postMessage(result));
}
