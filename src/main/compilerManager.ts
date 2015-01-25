import crypto = require('crypto');
import ts = require('typescript');
import fs = require('./fileSystem');
import promise = require('./promise');
import path = require('path');
import console = require('./logger');

function getHash(content: string): string {
    var shasum = crypto.createHash('sha1');
    shasum.update(content, 'utf8');
    return shasum.digest('hex').toString();
}


export type TypeScriptInfo = {
    path : string;
    typeScript: typeof ts;
    libLocation: string;
    documentRegistry: ts.DocumentRegistry;
}

type TypeScriptInfoMeta = {
    hash: string;
    count: number;
}


var typeScriptInfos: { [path: string]: TypeScriptInfo } = Object.create(null);
var typeScriptInfoMetas: { [path: string]: TypeScriptInfoMeta } = Object.create(null);
var fileSystem: fs.IFileSystem;
var defaultTypeScriptInfo: TypeScriptInfo;

export function init(fs: fs.IFileSystem, libLocation: string) {
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



export function getDefaultTypeScriptInfo(): TypeScriptInfo {
    return defaultTypeScriptInfo;
}


function createCompiler(typescriptPath: string,  code: string, libFile: string): TypeScriptInfo {
    var func = new Function(code + ';return ts;'),
        generatedTs: typeof ts = func();

    if (!generatedTs) {
        throw new Error('Invalid typescript file')
    }

    typeScriptInfos[typescriptPath] =  {
        typeScript: generatedTs,
        path: typescriptPath,
        libLocation: libFile,
        documentRegistry: generatedTs.createDocumentRegistry()
    };
    
    typeScriptInfoMetas[typescriptPath] = {
        hash: getHash(code),
        count: 1
    }
    return typeScriptInfos[typescriptPath];
}


export function acquireCompiler(typescriptPath: string): promise.Promise<TypeScriptInfo>  {
    return promise.Promise.resolve() 
        .then(() => {

            var typescriptServicesFile = path.join(typescriptPath, 'bin', 'typescriptServices.js');
            var libFile = path.join(typescriptPath, 'bin', 'lib.d.ts');


            return fileSystem.readFile(typescriptServicesFile).then(code => { 
                var meta = typeScriptInfoMetas[typescriptPath];
                var info = typeScriptInfos[typescriptPath];
                
                if (info && meta.hash === getHash(code)) {
                    meta.count++;
                    return info;
                } else {
                    return createCompiler(typescriptPath, code, libFile);
                }
            })
        })
}


export function releaseCompiler(typeScriptInfo: TypeScriptInfo): void {
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

