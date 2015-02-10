'use strict';

jest.dontMock('../utils');
jest.dontMock('../languageServiceHost');

import LanguageServiceHost = require('../languageServiceHost');
import utils = require('../utils');

describe('LanguageServiceHost', function () {
    var languageServiceHost: LanguageServiceHost;
    beforeEach(function () {
        languageServiceHost = LanguageServiceHost.create('/', 'lib.d.ts')
    });
    describe('CompilationSettings', function () {
        it('should copy the given compilation settings', function () {
            var compilationSettings: any = {
                foo: 'bar',
                hello : 'world'
            };
            
            languageServiceHost.setCompilationSettings(compilationSettings);
            expect(languageServiceHost.getCompilationSettings()).not.toBe(compilationSettings);
            expect(utils.clone(languageServiceHost.getCompilationSettings())).toEqual(compilationSettings);
        });
    });
    
    describe('Script Management', function () {
        it('should allows to add and remove script', function () {
            languageServiceHost.addScript('file1.ts', 'hello world');
            languageServiceHost.addScript('file2.ts', 'hello world');
            languageServiceHost.addScript('file3.ts', 'hello world');
            languageServiceHost.removeScript('file2.ts');
            expect(languageServiceHost.getScriptFileNames()).toEqual(['file1.ts', 'file3.ts']);
            languageServiceHost.removeAll();
            expect(languageServiceHost.getScriptFileNames()).toEqual([]);
        });
        
        it('should allows to update script content', function () {
            languageServiceHost.addScript('file1.ts', 'hello world');
            languageServiceHost.updateScript('file1.ts', 'foo bar');
            var snapshot = languageServiceHost.getScriptSnapshot('file1.ts');
            expect(snapshot.getText(0, snapshot.getLength())).toBe('foo bar');
            expect(languageServiceHost.getScriptVersion('file1.ts')).toBe('2');
        });
        
        it('should throws an error if the updated script does not exists', function () {
            expect(function () {
                languageServiceHost.updateScript('file1.ts', 'hello world');
            }).toThrow();
        });
        
        it('should allows to mark a script as \'open\'', function () {
            languageServiceHost.addScript('file1.ts', 'hello world');
            languageServiceHost.addScript('file2.ts', 'hello world');
            
            languageServiceHost.setScriptIsOpen('file1.ts', true);
            languageServiceHost.setScriptIsOpen('file2.ts', true);
            expect(languageServiceHost.getScriptIsOpen('file1.ts')).toBe(true);
            expect(languageServiceHost.getScriptIsOpen('file2.ts')).toBe(true);
            
            languageServiceHost.setScriptIsOpen('file1.ts', false);
            expect(languageServiceHost.getScriptIsOpen('file1.ts')).toBe(false);
            expect(languageServiceHost.getScriptIsOpen('file2.ts')).toBe(true);
            
            expect(function () {
                languageServiceHost.setScriptIsOpen('file3.ts', true);
            }).toThrow();
        });
        
        it('should allows to edit script', function () {
            languageServiceHost.addScript('file1.ts', 'hello world');
            var snapshotV1 = languageServiceHost.getScriptSnapshot('file1.ts');
            expect(snapshotV1.getText(0, snapshotV1.getLength())).toBe('hello world');
            
            languageServiceHost.editScript('file1.ts', 6, 11, 'bar');
            var snapshotV2 = languageServiceHost.getScriptSnapshot('file1.ts');
            expect(snapshotV2.getText(0, snapshotV2.getLength())).toBe('hello bar');
            expect(languageServiceHost.getScriptVersion('file1.ts')).toBe('2');
            
            
            languageServiceHost.editScript('file1.ts', 0, 5, 'foo');
            var snapshotV3 = languageServiceHost.getScriptSnapshot('file1.ts');
            expect(snapshotV3.getText(0, snapshotV3.getLength())).toBe('foo bar');
            expect(languageServiceHost.getScriptVersion('file1.ts')).toBe('3');
            
            expect(snapshotV3.getChangeRange(snapshotV2).isUnchanged()).toBe(false);
            expect(snapshotV3.getChangeRange(snapshotV3).isUnchanged()).toBe(true);
            
            
            expect(function () {
                languageServiceHost.editScript('file3.ts', 6, 11, 'bar');
            }).toThrow();
            
            
            languageServiceHost.updateScript('file1.ts', 'hello world');
            expect(languageServiceHost.getScriptSnapshot('file1.ts').getChangeRange(snapshotV1)).toBe(null);
        });
        
        
        it('should provide default value when there is no script', function () {
            expect(languageServiceHost.getScriptSnapshot('file1.ts')).toBeNull();
            expect(languageServiceHost.getScriptVersion('file1.ts')).toBe('0');
            expect(languageServiceHost.getScriptIsOpen('file1.ts')).toBe(false);
        });
        
    });
});