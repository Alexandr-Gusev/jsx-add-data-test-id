#!/usr/bin/env node

const startTs = new Date().getTime();

const commander = require("commander");
const fs = require("fs");
const {v4: uuid4} = require("uuid");
const {parse} = require("@babel/parser");
const {default: traverse} = require("@babel/traverse");
const path = require("path");
const {customAlphabet} = require("nanoid");

commander
	.option("-i, --include-dirs <value...>")
	.option("-e, --exclude-dirs <value...>", undefined, [])
	.option("-n, --id-name <value>", undefined, "data-testid")
	.option("--extensions <value...>", undefined, ["js"])
	.option("--indentation <value>", undefined, "tab")
	.option("--quotes <value>", undefined, "double")
	.option("--cache <value>", undefined, ".jsx-add-data-test-id-cache.json")
	.option("--disable-cache")
	.option("--allow-duplicates")
	.option("--disable-modification")
	.option("--disable-insertion")
	.option("--id-generator <value>", undefined, "nanoid")
	.option("--include-elements <value...>", undefined, [])
	.option("--exclude-elements <value...>", undefined, ["Fragment"])
	.option("--expected-attributes <value...>", undefined, [])
	.option("--always-update-empty-attributes")
	.parse();
const opts = commander.opts();
opts.excludeDirs = new Set(opts.excludeDirs.map(dir => dir.replace(/\\/g, "/")));
opts.extensions = new Set(opts.extensions.map(e => `.${e}`));
opts.indentation = opts.indentation === "tab" ? "\t" : " ".repeat(opts.indentation);
opts.quotes = opts.quotes === "double" ? "\"" : "'";
opts.includeElements = new Set(opts.includeElements);
opts.excludeElements = new Set(opts.excludeElements);
opts.expectedAttributes = new Set(opts.expectedAttributes);

let originalCache = {};
if (!opts.disableCache && fs.existsSync(opts.cache)) {
	try {
		originalCache = JSON.parse(fs.readFileSync(opts.cache, {encoding: "utf8"}));
		for (const fn of Object.keys(originalCache)) {
			originalCache[fn].ids = new Set(originalCache[fn].ids);
		}
	} catch (err) {
		console.warn(`WARNING: can not parse ${opts.cache}, empty cache will be used`);
	}
}
const cache = {};

const ids = new Set();
const duplicates = new Set();

const nanoid = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8);
const idGenerator = opts.idGenerator === "nanoid" ? nanoid : uuid4;

let newIdsCount = 0;

const getId = () => {
	let id = idGenerator();
	while (ids.has(id)) {
		id = idGenerator();
	}
	ids.add(id);
	newIdsCount++;
	return id;
};

const insertId = (newData, data, start, end, prevEnd, id) => {
	if (end - start === 2) {
		newData.push(data.substring(prevEnd, end - 2));
		newData.push(`${opts.quotes}${id}${opts.quotes}`);
		return;
	}

	const сlosed = data.charAt(end - 2) === "/";

	newData.push(data.substring(prevEnd, end - (сlosed ? 2 : 1)));

	const position = data.lastIndexOf("\n", end - 1);
	let prefix;
	let suffix;
	if (position < start) {
		prefix = сlosed ? "" : " ";
		suffix = сlosed ? " />" : ">";
	} else {
		prefix = opts.indentation;
		const first = data.substring(position + 1, end - (сlosed ? 2 : 1));
		const second = сlosed ? "/>" : ">";
		suffix = `\n${first}${second}`;
	}
	newData.push(`${prefix}${opts.idName}=${opts.quotes}${id}${opts.quotes}${suffix}`);
};

let modificatedFilesCount = 0;

const transform = (fn, data, callback) => {
	const cacheForFile = cache[fn];

	const ast = parse(data, {
		sourceFilename: fn,
		sourceType: "module",
		plugins: [
			["jsx"]
		]
	});

	const positions = [];
	traverse(ast, {
		JSXOpeningElement(p) {
			const elementName = p.node.name && p.node.name.name;
			const wanted = (
				(!opts.includeElements.size || opts.includeElements.has(elementName))
				&& !opts.excludeElements.has(elementName)
				&& (
					!opts.expectedAttributes.size
					|| (
						p.node.attributes
						&& p.node.attributes.find(
							node => node.name && opts.expectedAttributes.has(node.name.name)
						)
					)
				)
			);
			const attribute = p.node.attributes && p.node.attributes.find(
				node => node.name && node.name.name === opts.idName
			);
			if (attribute) {
				const value = attribute.value && attribute.value.value;
				if (ids.has(value)) {
					duplicates.add(value);
				}
				if (value === "") {
					if (wanted || opts.alwaysUpdateEmptyAttributes) {
						positions.push(attribute.value);
					}
				} else {
					ids.add(value);
					cacheForFile.ids.add(value);
				}
			} else if (wanted && !opts.disableInsertion) {
				positions.push(p.node);
			}
		}
	});

	if (!positions.length) {
		callback();
		return;
	}

	const newData = [];
	let prevEnd = 0;
	for (const {start, end} of positions.sort((a, b) => a.end - b.end)) {
		const id = getId();
		cacheForFile.ids.add(id);
		insertId(newData, data, start, end, prevEnd, id);
		prevEnd = end;
	}
	newData.push(data.substring(prevEnd));

	if (opts.disableModification) {
		callback();
		return;
	}

	fs.writeFile(`${fn}.tmp`, newData.join(""), {encoding: "utf8"}, err => {
		if (err) {
			console.error(`ERROR: can not write ${fn}.tmp`);
			process.exit(1);
		}
		fs.unlink(fn, err => {
			if (err) {
				console.error(`ERROR: can not unlink ${fn}`);
				process.exit(1);
			}
			fs.rename(`${fn}.tmp`, fn, err => {
				if (err) {
					console.error(`ERROR: can not rename ${fn}.tmp to ${fn}`);
					process.exit(1);
				}
				modificatedFilesCount++;
				callback();
			});
		});
	});
};

const changedFiles = [];
const unchangedFiles = [];

class JobCounter {
	constructor(callback) {
		this.counter = 0;
		this.callback = callback;
	}

	inc() {
		this.counter++;
	}

	dec() {
		this.counter--;
		if (!this.counter) {
			this.callback();
		}
	}
}

const transformJobCounter = new JobCounter(() => {
	const err = duplicates.size && !opts.allowDuplicates;
	if (!err && !opts.disableModification && !opts.disableCache) {
		for (const fn of Object.keys(cache)) {
			cache[fn].ids = [...cache[fn].ids];
		}
		fs.writeFileSync(opts.cache, JSON.stringify(cache), {encoding: "utf8"});
	}
	const stopTs = new Date().getTime();
	console.log(`Files processed: ${changedFiles.length}`);
	console.log(`Files modificated: ${modificatedFilesCount}`);
	console.log(`IDs new: ${newIdsCount}`);
	console.log(`IDs total: ${ids.size}`);
	console.log(`Duplicates: ${[...duplicates].join(", ")}`);
	console.log(`Processing time: ${stopTs - startTs} ms`);
	if (err) {
		console.error("ERROR: duplicates are not allowed");
	}
	process.exit(err ? 1 : 0);
});

const collectJobCounter = new JobCounter(() => {
	for (const fn of unchangedFiles) {
		for (const id of cache[fn].ids) {
			ids.add(id);
		}
	}
	transformJobCounter.inc();
	for (const fn of changedFiles) {
		transformJobCounter.inc();
		fs.readFile(fn, {encoding: "utf8"}, (err, data) => {
			if (err) {
				console.error(`ERROR: can not read ${fn}`);
				process.exit(1);
			}
			transform(fn, data, () => {
				fs.stat(fn, (err, stats) => {
					if (err) {
						console.error(`ERROR: can not get stat for ${fn}`);
						process.exit(1);
					}
					cache[fn].mt = stats.mtime.getTime();
					transformJobCounter.dec();
				});
			});
		});
	}
	transformJobCounter.dec();
});

const collectChangedFiles = dir => {
	if (opts.excludeDirs.has(dir.replace(/\\/g, "/"))) {
		return;
	}
	collectJobCounter.inc();
	fs.readdir(dir, {encoding: "utf8"}, (err, files) => {
		if (err) {
			console.error(`ERROR: can not read dir ${dir}`);
			process.exit(1);
		}
		for (const file of files) {
			const fn = path.join(dir, file);
			collectJobCounter.inc();
			fs.stat(fn, (err, stats) => {
				if (err) {
					console.error(`ERROR: can not get stat for ${fn}`);
					process.exit(1);
				}
				if (stats.isDirectory()) {
					collectChangedFiles(fn);
				} else if (opts.extensions.has(path.extname(fn))) {
					let info = originalCache[fn];
					const t = stats.mtime.getTime();
					if (!info || info.mt !== t) {
						info = {
							ids: new Set()
						};
						changedFiles.push(fn);
					} else {
						unchangedFiles.push(fn);
					}
					cache[fn] = info;
				}
				collectJobCounter.dec();
			});
		}
		collectJobCounter.dec();
	});
};

for (const dir of opts.includeDirs) {
	collectChangedFiles(dir);
}
