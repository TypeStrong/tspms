'use strict';

import ts = require('typescript');
import fs = require('./fileSystem');
import promise = require('./promise');
import path = require('path');
import utils = require('./utils');
import Map = utils.Map;

/**
 * @module CompilerManager
 * 
 * This module manage the different compiler version used by the services. 
 * For a given path it will `instanciate`  a `ts` module for a given compiler 
 * and release it when no project use it anymore.
 */


//--------------------------------------------------------------------------
//
//  Type Definitions
//
//--------------------------------------------------------------------------

/**
 * Informations used by project to use a given version of the typescript compiler
 */
export type TypeScriptInfo = {
    /**
     * Absolute path of the compiler directory
     */
    compilerDirectory: string;
    
    /**
     * compiler `ts` module instance 
     */
    ts: typeof ts;
    
    /**
     * absolute filename of the `lib.d.ts` file associated with the compiler 
     */
    defaultLibFileName: string;
    
    /**
     * TypeScript DocumentRegistry shared by projects using the same version of the compiler
     */
    documentRegistry: ts.DocumentRegistry;
}

/**
 * Meta informations used for management of the different compiler instance
 */
type TypeScriptMeta = {
    /**
     * sha-sum of the typeScriptServices file associated to the compiler
     * Used to check if a compiler file has changed between 2 acquires
     */
    hash: string;
    
    /**
     * counter increased each times a project
     */
    count: number;
}


//--------------------------------------------------------------------------
//
//  Internal API
//
//--------------------------------------------------------------------------

/**
 * A map compilerDirectory to TypeScriptInfo.
 */
var typeScriptInfos: Map<TypeScriptInfo> = Object.create(null);

/** 
 * A map compilerDirectory to TypeScriptMeta.
 */
var typeScriptMetas: Map<TypeScriptMeta> = Object.create(null);

/**
 * The fileSystem wrapper instance used by this module.
 */
var fileSystem: fs.IFileSystem;

/**
 * Information related to the `default` compiler bundled with the service.
 */
var defaultTypeScriptInfo: TypeScriptInfo;



/**
 * For a give typescript compiler directory path create TypeScriptInfo
 * 
 * @param compilerDirectory compiler directory
 * @param content content of the `typescriptServices.js` file associated to the compiler
 * @param defaultLibFileName absolute fileName of the `lib.d.ts` file associated to the compiler 
 * @param hash sha-sum of the `typescriptServices.js` file associated to the compiler
 */
function createCompiler(compilerDirectory: string, content: string, defaultLibFileName: string, hash: string): TypeScriptInfo {
    var generatedTs: typeof ts = (new Function(content + ';return ts;'))();

    if (!generatedTs) {
        throw new Error('Invalid typescript file')
    }

    typeScriptInfos[compilerDirectory] = {
        compilerDirectory,
        ts: generatedTs,
        defaultLibFileName,
        documentRegistry: generatedTs.createDocumentRegistry()
    };

    typeScriptMetas[compilerDirectory] = {
        hash: hash,
        count: 1
    }

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
export function init(fs: fs.IFileSystem, defaultLibFileName: string) {
    fileSystem = fs;
    typeScriptInfos = Object.create(null);
    typeScriptMetas = Object.create(null);
    defaultTypeScriptInfo = {
        compilerDirectory: '',
        ts,
        defaultLibFileName,
        documentRegistry: ts.createDocumentRegistry()
    };

    Object.freeze(defaultTypeScriptInfo);
}

/**
 * Retrieve information related to the `default` compiler bundled with the service.
 */
export function getDefaultTypeScriptInfo(): TypeScriptInfo {
    return defaultTypeScriptInfo;
}

/**
 * Acquire typescript information for the given path.
 * 
 * @param compilerDirectory the directory of the compiler
 */
export function acquireCompiler(compilerDirectory: string): promise.Promise<TypeScriptInfo> {
    var typescriptServicesFileName = path.join(compilerDirectory, 'bin', 'typescriptServices.js');
    var defaultLibFileName = path.join(compilerDirectory, 'bin', 'lib.d.ts');

    return fileSystem.readFile(typescriptServicesFileName).then(content => {
        var meta = typeScriptMetas[compilerDirectory];
        var info = typeScriptInfos[compilerDirectory];
        var hash = utils.getHash(content);

        if (info && meta.hash === hash) {
            meta.count++;
            return info;
        } else {
            return createCompiler(compilerDirectory, content, defaultLibFileName, hash);
        }
    });
}

/**
 * Release typescriptInfo acquired through this manager.
 * 
 * @param typeScriptInfo the `TypeScriptInfo` object acquired throuh this manager
 */
export function releaseCompiler(typeScriptInfo: TypeScriptInfo): void {
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

/**
 * Dispose the CompilerManager module.
 */
export function dispose() {
    typeScriptInfos = Object.create(null);
    typeScriptMetas = Object.create(null);
    defaultTypeScriptInfo = null;
    fileSystem = null;
}
