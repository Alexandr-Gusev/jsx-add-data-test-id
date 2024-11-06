#!/usr/bin/env node

const startTs = new Date().getTime();

const commander = require("commander");
const fs = require("fs");
const {v4: uuid4} = require("uuid");
const {parse} = require("@babel/parser");
const {default: traverse} = require("@babel/traverse");
const path = require("path");

commander
	.option("-i, --include-dirs <value...>")
	.option("-e, --exclude-dirs <value...>")
	.option("-n, --id-name <value>", undefined, "data-testid")
	.option("--ext <value>", undefined, "js")
	.option("--indentation <value>", undefined, "tab")
	.option("--quotes <value>", undefined, "double")
	.option("--cache <value>", undefined, ".add-testid-cache.json")
	.parse();
const opts = commander.opts();
opts.excludeDirs = new Set((opts.excludeDirs || []).map(dir => dir.replace(/\\/g, "/")));
opts.ext = `.${opts.ext}`;
opts.indentation = opts.indentation === "tab" ? "\t" : " ".repeat(opts.indentation);
opts.quotes = opts.quotes === "double" ? "\"" : "'";

let originalCache = {};
try {
	originalCache = JSON.parse(fs.readFileSync(opts.cache, {encoding: "utf8"}));
} catch (err) {
	// ignore
}
const cache = {};

const ids = new Set();

const getId = () => {
	let id = uuid4();
	while (ids.has(id)) {
		id = uuid4();
	}
	ids.add(id);
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

const transform = (fn, data, callback) => {
	const cacheForFile = cache[fn];

	const ast = parse(data, {
		sourceType: "module",
		plugins: [
			["jsx"]
		]
	});

	const positions = [];
	traverse(ast, {
		JSXOpeningElement(p) {
			const attribute = p.node.attributes && p.node.attributes.find(
				node => node.name && node.name.name === opts.idName
			);
			if (attribute) {
				const value = attribute.value && attribute.value.value;
				if (ids.has(value)) {
					console.error(`more than one occurrence of ${value} was found`);
					process.exit(1);
				} else if (value === "") {
					positions.push(attribute.value);
				} else {
					ids.add(value);
					cacheForFile.ids.push(value);
				}
			} else {
				positions.push(p.node);
			}
		}
	});

	const newData = [];
	let prevEnd = 0;
	for (const {start, end} of positions.sort((a, b) => a.end - b.end)) {
		const id = getId();
		cacheForFile.ids.push(id);
		insertId(newData, data, start, end, prevEnd, id);
		prevEnd = end;
	}
	newData.push(data.substring(prevEnd));

	fs.writeFile(`${fn}.tmp`, newData.join(""), {encoding: "utf8"}, err => {
		if (err) {
			console.error(`can not write ${fn}.tmp`);
			process.exit(1);
		}
		fs.unlink(fn, err => {
			if (err) {
				console.error(`can not unlink ${fn}`);
				process.exit(1);
			}
			fs.rename(`${fn}.tmp`, fn, err => {
				if (err) {
					console.error(`can not rename ${fn}.tmp to ${fn}`);
					process.exit(1);
				}
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
	fs.writeFileSync(opts.cache, JSON.stringify(cache), {encoding: "utf8"});
	const stopTs = new Date().getTime();
	console.log(`changed files: ${changedFiles.length}, processing time: ${stopTs - startTs} ms`);
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
				console.error(`can not read ${fn}`);
				process.exit(1);
			}
			transform(fn, data, () => {
				fs.stat(fn, (err, stats) => {
					if (err) {
						console.error(`can not get stat for ${fn}`);
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
			console.error(`can not read dir ${dir}`);
			process.exit(1);
		}
		for (const file of files) {
			const fn = path.join(dir, file);
			collectJobCounter.inc();
			fs.stat(fn, (err, stats) => {
				if (err) {
					console.error(`can not get stat for ${fn}`);
					process.exit(1);
				}
				if (stats.isDirectory()) {
					collectChangedFiles(fn);
				} else if (fn.endsWith(opts.ext)) {
					let info = originalCache[fn];
					const t = stats.mtime.getTime();
					if (!info || info.mt !== t) {
						info = {
							ids: []
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
