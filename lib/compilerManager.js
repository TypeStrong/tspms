'use strict';
var ts = require('typescript');
var path = require('path');
var utils = require('./utils');
//--------------------------------------------------------------------------
//
//  Internal API
//
//--------------------------------------------------------------------------
/**
 * A map compilerDirectory to TypeScriptInfo.
 */
var typeScriptInfos = Object.create(null);
/**
 * A map compilerDirectory to TypeScriptMeta.
 */
var typeScriptMetas = Object.create(null);
/**
 * The fileSystem wrapper instance used by this module.
 */
var fileSystem;
/**
 * Information related to the `default` compiler bundled with the service.
 */
var defaultTypeScriptInfo;
/**
 * For a give typescript compiler directory path create TypeScriptInfo
 *
 * @param compilerDirectory compiler directory
 * @param content content of the `typescriptServices.js` file associated to the compiler
 * @param defaultLibFileName absolute fileName of the `lib.d.ts` file associated to the compiler
 * @param hash sha-sum of the `typescriptServices.js` file associated to the compiler
 */
function createCompiler(compilerDirectory, content, defaultLibFileName, servicesFileName, hash) {
    var generatedTs = (new Function(content + ';return ts;'))();
    if (!generatedTs) {
        throw new Error('Invalid typescript file');
    }
    typeScriptInfos[compilerDirectory] = {
        compilerDirectory: compilerDirectory,
        servicesFileName: servicesFileName,
        ts: generatedTs,
        defaultLibFileName: defaultLibFileName,
        documentRegistry: generatedTs.createDocumentRegistry()
    };
    typeScriptMetas[compilerDirectory] = {
        hash: hash,
        count: 1
    };
    Object.freeze(typeScriptInfos[compilerDirectory]);
    return typeScriptInfos[compilerDirectory];
}
//--------------------------------------------------------------------------
//
//  Public API
//
//--------------------------------------------------------------------------
/**
 * Initialialize the CompilerManager module.
 *
 * @param fs the fileSystem the compilerManager
 */
function init(fs, defaultLibFileName) {
    fileSystem = fs;
    typeScriptInfos = Object.create(null);
    typeScriptMetas = Object.create(null);
    defaultTypeScriptInfo = {
        compilerDirectory: '<bundled-compiler-dir>',
        servicesFileName: '<bundled-serviceFile>',
        ts: ts,
        defaultLibFileName: defaultLibFileName,
        documentRegistry: ts.createDocumentRegistry()
    };
    Object.freeze(defaultTypeScriptInfo);
}
exports.init = init;
/**
 * Retrieve information related to the `default` compiler bundled with the service.
 */
function getDefaultTypeScriptInfo() {
    return defaultTypeScriptInfo;
}
exports.getDefaultTypeScriptInfo = getDefaultTypeScriptInfo;
/**
 * Acquire typescript information for the given path.
 *
 * @param compilerDirectory the directory of the compiler
 */
function acquireCompiler(compilerDirectory) {
    var servicesFileName = path.join(compilerDirectory, 'bin', 'typescriptServices.js');
    var defaultLibFileName = path.join(compilerDirectory, 'bin', 'lib.d.ts');
    return fileSystem.readFile(servicesFileName).then(function (content) {
        var meta = typeScriptMetas[compilerDirectory];
        var info = typeScriptInfos[compilerDirectory];
        var hash = utils.getHash(content);
        if (info && meta.hash === hash) {
            meta.count++;
            return info;
        }
        else {
            return createCompiler(compilerDirectory, content, defaultLibFileName, servicesFileName, hash);
        }
    });
}
exports.acquireCompiler = acquireCompiler;
/**
 * Release typescriptInfo acquired through this manager.
 *
 * @param typeScriptInfo the `TypeScriptInfo` object acquired throuh this manager
 */
function releaseCompiler(typeScriptInfo) {
    var cached = typeScriptInfos[typeScriptInfo.compilerDirectory];
    if (cached === typeScriptInfo) {
        var meta = typeScriptMetas[typeScriptInfo.compilerDirectory];
        meta.count--;
        if (meta.count === 0) {
            delete typeScriptInfos[typeScriptInfo.compilerDirectory];
            delete typeScriptMetas[typeScriptInfo.compilerDirectory];
        }
    }
}
exports.releaseCompiler = releaseCompiler;
/**
 * Dispose the CompilerManager module.
 */
function dispose() {
    typeScriptInfos = Object.create(null);
    typeScriptMetas = Object.create(null);
    defaultTypeScriptInfo = null;
    fileSystem = null;
}
exports.dispose = dispose;
