var crypto = require('crypto');
var ts = require('typescript');
var promise = require('./promise');
var path = require('path');
function getHash(content) {
    var shasum = crypto.createHash('sha1');
    shasum.update(content, 'utf8');
    return shasum.digest('hex').toString();
}
var typeScriptInfos = Object.create(null);
var typeScriptInfoMetas = Object.create(null);
var fileSystem;
var defaultTypeScriptInfo;
function init(fs, libLocation) {
    fileSystem = fs;
    typeScriptInfos = Object.create(null);
    typeScriptInfoMetas = Object.create(null);
    defaultTypeScriptInfo = {
        id: 'default',
        path: libLocation,
        typeScript: ts,
        libLocation: libLocation,
        documentRegistry: ts.createDocumentRegistry()
    };
}
exports.init = init;
function getDefaultTypeScriptInfo() {
    return defaultTypeScriptInfo;
}
exports.getDefaultTypeScriptInfo = getDefaultTypeScriptInfo;
function createCompiler(typescriptPath, code, libFile) {
    var func = new Function(code + ';return ts;'), generatedTs = func();
    if (!generatedTs) {
        throw new Error('Invalid typescript file');
    }
    typeScriptInfos[typescriptPath] = {
        typeScript: generatedTs,
        path: typescriptPath,
        libLocation: libFile,
        documentRegistry: generatedTs.createDocumentRegistry()
    };
    typeScriptInfoMetas[typescriptPath] = {
        hash: getHash(code),
        count: 1
    };
    return typeScriptInfos[typescriptPath];
}
function acquireCompiler(typescriptPath) {
    return promise.Promise.resolve().then(function () {
        var typescriptServicesFile = path.join(typescriptPath, 'bin', 'typescriptServices.js');
        var libFile = path.join(typescriptPath, 'bin', 'lib.d.ts');
        return fileSystem.readFile(typescriptServicesFile).then(function (code) {
            var meta = typeScriptInfoMetas[typescriptPath];
            var info = typeScriptInfos[typescriptPath];
            if (info && meta.hash === getHash(code)) {
                meta.count++;
                return info;
            }
            else {
                return createCompiler(typescriptPath, code, libFile);
            }
        });
    });
}
exports.acquireCompiler = acquireCompiler;
function releaseCompiler(typeScriptInfo) {
    var cached = typeScriptInfos[typeScriptInfo.path];
    var meta = typeScriptInfoMetas[typeScriptInfo.path];
    if (cached === typeScriptInfo) {
        meta.count--;
        if (meta.count === 0) {
            delete typeScriptInfos[typeScriptInfo.path];
            delete typeScriptInfoMetas[typeScriptInfo.path];
        }
    }
}
exports.releaseCompiler = releaseCompiler;
