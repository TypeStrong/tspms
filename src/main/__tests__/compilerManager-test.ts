'use strict';

jest.dontMock('../compilerManager');
jest.dontMock('./fileSystemMock');
jest.dontMock('../utils');
jest.dontMock('./fileSystemMock');


import CompilerManager = require('../compilerManager');
import FileSystemMock = require('./fileSystemMock');
import ts = require('typescript')

describe('CompilerManager', function () {
    var fileSystemMock: FileSystemMock;
    
    beforeEach(function () {
        (<any>jest).useRealTimers();
        fileSystemMock = new FileSystemMock();
    });
    
    afterEach(function () {
        (<any>jest).useFakeTimers();
        fileSystemMock.dispose();
        CompilerManager.dispose();
    });
    
    describe('getDefaultTypeScriptInfo', function () {
        it('should return info related to the bundled typescript compiler instance', function () {
            spyOn(ts, 'createDocumentRegistry').andReturn({ fake: true});
            CompilerManager.init(fileSystemMock, '/lib.d.ts');

            var info = CompilerManager.getDefaultTypeScriptInfo();
            expect(info.ts).toBe(ts);
            expect(info.defaultLibFileName).toBe('/lib.d.ts');
            expect(info.documentRegistry).toEqual({fake: true});
        });
    });
    
    describe('acquireCompiler', function () {
        beforeEach(function () {
            CompilerManager.init(fileSystemMock, '/lib.d.ts');
        });
        
        pit('should instanciate a new compiler version the first time it is called', function () {
            
            fileSystemMock.setFiles({
                '/typescript/bin/typescriptServices.js' : 
                    'var ts = { ' +
                    '  isFake: true,'+
                    '  createDocumentRegistry: function () {  return { fake1: true }; }' +
                    '};' 
            });
            
            
            return CompilerManager.acquireCompiler('/typescript').then(info => {
                expect((<any>info.ts).isFake).toBe(true);
                expect(info.documentRegistry).toEqual({fake1: true});
                expect(info.compilerDirectory).toBe('/typescript');
                expect(info.defaultLibFileName).toBe('/typescript/bin/lib.d.ts');
            });
            
        });
        
        pit('on subsquent call it should not create a new instance if the file has not changed', function () {
            fileSystemMock.setFiles({
                '/typescript/bin/typescriptServices.js' : 
                    'var ts = { ' +
                    '  createDocumentRegistry: function () { }' +
                    '};' 
            });
            
            return CompilerManager.acquireCompiler('/typescript').then(info1 => {
                return CompilerManager.acquireCompiler('/typescript').then(info2 => {
                    expect(info2).toBe(info1);
                    expect(info2.ts).toBe(info1.ts);
                })
            });
        });
        
        pit('on subsquent call it should re create a new instance if the file has changed', function () {
            fileSystemMock.setFiles({
                '/typescript/bin/typescriptServices.js' : 
                    'var ts = { ' +
                    '  createDocumentRegistry: function () { }' +
                    '};' 
            });
            
            return CompilerManager.acquireCompiler('/typescript').then(info1 => {
                fileSystemMock.setFiles({
                    '/typescript/bin/typescriptServices.js' : 
                        'var ts = { ' +
                        '  change: true,'+
                        '  createDocumentRegistry: function () { }' +
                        '};' 
                });
                return CompilerManager.acquireCompiler('/typescript').then(info2 => {
                    expect(info2).not.toBe(info1);
                    expect(info2.ts).not.toBe(info1.ts);
                })
            });
        });
    });
    
    describe('release compiler', function () {
        var typeScriptInfo: CompilerManager.TypeScriptInfo;
        beforeEach(function () {
            CompilerManager.init(fileSystemMock, '/lib.d.ts');
            fileSystemMock.setFiles({
                '/typescript/bin/typescriptServices.js' : 
                    'var ts = { ' +
                    '  createDocumentRegistry: function () { }' +
                    '};' 
            });
            CompilerManager.acquireCompiler('/typescript').then(info => {
                typeScriptInfo = info;
            });
            
            waitsFor(() => !!typeScriptInfo);
        });
        
        afterEach(function () {
            typeScriptInfo = null;
        });
        
        pit('it should release the generated info', function () {
            CompilerManager.releaseCompiler(typeScriptInfo);
            return CompilerManager.acquireCompiler('/typescript').then(info => {
                expect(info).not.toBe(typeScriptInfo);
                expect(info.ts).not.toBe(typeScriptInfo.ts);
            })
        });
        
        pit('it should not release the generated info if another acquire has been called', function () {
            return CompilerManager.acquireCompiler('/typescript')
            .then(() => {
                CompilerManager.releaseCompiler(typeScriptInfo);
                return CompilerManager.acquireCompiler('/typescript');
            }).then(info => {
                expect(info).toBe(typeScriptInfo);
                expect(info.ts).toBe(typeScriptInfo.ts);
                
                CompilerManager.releaseCompiler(typeScriptInfo);
                CompilerManager.releaseCompiler(typeScriptInfo);
                
                return CompilerManager.acquireCompiler('/typescript');
            }).then(info => {
                expect(info).not.toBe(typeScriptInfo);
                expect(info.ts).not.toBe(typeScriptInfo.ts);
            })
        });
        
        pit('it should not release a compiler path if the info comes from an old version', function () {
            fileSystemMock.setFiles({
                '/typescript/bin/typescriptServices.js' : 
                    'var ts = { ' +
                    '  change: true,'+
                    '  createDocumentRegistry: function () { }' +
                    '};' 
            });
            return CompilerManager.acquireCompiler('/typescript').then(info1 => {
                CompilerManager.releaseCompiler(typeScriptInfo);
                CompilerManager.releaseCompiler(typeScriptInfo);
                
                return CompilerManager.acquireCompiler('/typescript').then(info2 => {
                     expect(info2).toBe(info1);
                     expect(info2.ts).toBe(info1.ts);
                });
            })
        });
        
       
    });
});