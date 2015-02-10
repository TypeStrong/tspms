'use strict';

import ts = require('typescript');
import path = require('path');
import utils = require('./utils');
import console = require('./logger');

import Map = utils.Map;

//--------------------------------------------------------------------------
//
//  Type Definitions
//
//--------------------------------------------------------------------------

/**
 * The LanguageServiceHost module provides an ts.LanguageServiceHost implementations 
 */
interface LanguageServiceHost extends ts.LanguageServiceHost {
    /**
     * Add a script to the LanguageServiceHost.
     * 
     * @param fileName the absolute path of the file.
     * @param content the file content.
     */
    addScript(fileName: string, content: string): void;
    
    /**
     * Remove a script from the LanguageServiceHost.
     * 
     * @param fileName the absolute path of the file.
     */
    removeScript(fileName: string): void;
    
    /**
     * Remove all script from the LanguageServiceHost.
     * 
     * @param fileName the absolute path of the file.
     */
    removeAll(): void;
    
    /**
     * Update a script.
     * 
     * @param fileName the absolute path of the file.
     * @param content the new file content.
     */
    updateScript(fileName: string, content: string): void;

    /**
     * Edit a script.
     * 
     * @param fileName the absolute path of the file
     * @param minChar the index in the file content where the edition begins.
     * @param limChar the index  in the file content where the edition ends.
     * @param newText the text inserted.
     */
    editScript(fileName: string, minChar: number, limChar: number, newText: string): void;
    
    /**
     * Set the `isOpen` status of a script.
     * 
     * @param fileName the absolute file name.
     * @param isOpen open status.
     */
    setScriptIsOpen(fileName: string, isOpen: boolean): void;
    
    /**
     * The the language service host compilater options.
     * 
     * @param the settings to be applied to the host.
     */
    setCompilationSettings(settings: ts.CompilerOptions): void;
    
    /**
     * Retrieve the content of a given file.
     * 
     * @param fileName the absolute file name.
     */
    getScriptContent(fileName: string): string;

}

module LanguageServiceHost {
    
    //--------------------------------------------------------------------------
    //
    //  LanguageServiceHost factory
    //
    //--------------------------------------------------------------------------
    
    /**
     * LanguageServiceHost factory.
     * 
     * @param currentDir the current directory opened in the editor
     * @param defaultLibFileName the absolute file name of the `lib.d.ts` files associated to the language service host instance.
     */
    export function create(currentDir: string, defaultLibFileName: string): LanguageServiceHost {

        /**
         * CompilationSettings;
         */
        var compilationSettings: ts.CompilerOptions;

        /**
         * A map associating absolute file name to ScriptInfo.
         */
        var fileNameToScript: Map<ScriptInfo> = Object.create(null);

        /**
         * Add a script to the LanguageServiceHost.
         * 
         * @param fileName the absolute path of the file.
         * @param content the file content.
         */
        function addScript(fileName: string, content: string) {
            var script = createScriptInfo(content);
            fileNameToScript[fileName] = script;
        }

        /**
         * Remove a script from the LanguageServiceHost.
         * 
         * @param fileName the absolute path of the file.
         */
        function removeScript(fileName: string) {
            delete fileNameToScript[fileName];
        }

        /**
         * Remove all script from the LanguageServiceHost.
         * 
         * @param fileName the absolute path of the file.
         */
        function removeAll(): void {
            fileNameToScript = Object.create(null);
        }

        /**
         * Update a script.
         * 
         * @param fileName the absolute path of the file.
         * @param content the new file content.
         */
        function updateScript(fileName: string, content: string) {
            var script = fileNameToScript[fileName];
            if (script) {
                script.updateContent(content);
                return;
            }
            throw new Error('No script with name \'' + fileName + '\'');
        }

        /**
         * Edit a script.
         * 
         * @param fileName the absolute path of the file
         * @param minChar the index in the file content where the edition begins.
         * @param limChar the index  in the file content where the edition ends.
         * @param newText the text inserted.
         */
        function editScript(fileName: string, minChar: number, limChar: number, newText: string) {
            var script = fileNameToScript[fileName];
            if (script) {
                script.editContent(minChar, limChar, newText);
                return;
            }

            throw new Error('No script with name \'' + fileName + '\'');
        }

        /**
         * Set the `isOpen` status of a script.
         * 
         * @param fileName the absolute file name.
         * @param isOpen open status.
         */
        function setScriptIsOpen(fileName: string, isOpen: boolean) {
            var script = fileNameToScript[fileName];
            if (script) {
                script.setIsOpen(isOpen);
                return;
            }

            throw new Error('No script with name \'' + fileName + '\'');
        }

        /**
         * Set the language service host compilation settings.
         * 
         * @param the settings to be applied to the host
         */
        function setCompilationSettings(settings: ts.CompilerOptions): void{ 
            compilationSettings = Object.freeze(utils.clone(settings));
        }

        /**
         * Retrieve the content of a given script.
         * 
         * @param fileName the absolute path of the file.
         */
        function getScriptContent(fileName: string): string {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getContent();
            }
            return null;
        }

        /**
         * Return the version of a script for the given file name.
         * 
         * @param fileName the absolute path of the file.
         */
        function getScriptVersion(fileName: string): string {
            var script = fileNameToScript[fileName];
            if (script) {
                return '' + script.getVersion();
            }
            return '0';
        }

        /**
         * Return the 'open status' of a script for the given file name.
         * 
         * @param fileName the absolute path of the file.
         */
        function getScriptIsOpen(fileName: string): boolean {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getIsOpen();
            }
            return false;
        }

        /**
         * Return an IScriptSnapshot instance for the given file name.
         * 
         * @param fileName the absolute path of the file.
         */
        function getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getScriptSnapshot();
            }
            return null;
        }

        return {
            //ts.Logger implementation, actually master implementation instead of 1.4.1
            log: console.info,
            error: console.error,
            trace: console.info,

            // LanguageServiceHost implementation
            addScript,
            removeScript,
            removeAll,
            updateScript,
            editScript,
            getScriptContent,
            setCompilationSettings,
            setScriptIsOpen,

            // ts.LanguageServiceHost implementation
            getCompilationSettings: () => compilationSettings,
            getScriptFileNames: () => Object.keys(fileNameToScript),
            getCurrentDirectory: () => currentDir,
            getDefaultLibFilename: () => defaultLibFileName,
            getScriptVersion,
            getScriptIsOpen,
            getScriptSnapshot,
        };
    }
    
    //--------------------------------------------------------------------------
    //
    //  ScriptInfo
    //
    //--------------------------------------------------------------------------

    /**
     * Internal Script representation.
     */
    interface ScriptInfo {
        /**
         * Returns the content of the file associated to the script.
         */
        getContent(): string;
        
        /**
         * Update the script content.
         * 
         * @param newContent the new content of the file associated to the script.
         */
        updateContent(newContent: string): void;
        
        /**
         * Edit the script content.
         * 
         * @param minChar the index in the file content where the edition begins
         * @param limChar the index  in the file content where the edition ends
         * @param newText the text inserted
         */
        editContent(minChar: number, limChar: number, newText: string): void;
        
        /**
         * Returns the script version.
         */
        getVersion(): number;
        
        /**
         * Returns the `isOpen` status of the script.
         */
        getIsOpen(): boolean;
        
        /**
         * Set the `isOpen` status of the script.
         * 
         * @param isOpen
         */
        setIsOpen(isOpen: boolean): void;
        
        /**
         * Returns a `snapshot` of the script.
         */
        getScriptSnapshot(): ts.IScriptSnapshot;

    }
    
    /**
     * ScriptInfo factory.
     * 
     * @param content the content of the file associated to this script.
     */
    function createScriptInfo(content: string): ScriptInfo {
        
        /**
         * The script current version.
         */
        var scriptVersion: number = 1;
        
        /**
         * The script edit history.
         */
        var editRanges: ts.TextChangeRange[] = [];
        
        /**
         * the `isOpen` status of the Script
         */
        var isOpen = false
        
        /**
         * An array mapping the start of lines in the script to their position in the file.
         */
        var _lineStarts: number[];
        
        /**
         * A flag true if `_lineStarts` needs to be recomputed
         */
        var _lineStartIsDirty = true;

        /**
         * Retrieve the script `_lineStarts`, recompute them if needed.
         */
        function getLineStarts() {
            if (_lineStartIsDirty) {
                _lineStarts = ts.computeLineStarts(content);
                _lineStartIsDirty = false;
            }
            return _lineStarts;
        }

        /**
         * Update the script content.
         * 
         * @param newContent the new content of the file associated to the script.
         */
        function updateContent(newContent: string): void {
            if (newContent !== content) {
                content = newContent;
                _lineStartIsDirty = true;
                editRanges = [];
                scriptVersion++;
            }
        }

        /**
         * Edit the script content.
         * 
         * @param minChar the index in the file content where the edition begins
         * @param limChar the index  in the file content where the edition ends
         * @param newText the text inserted
         */
        function editContent(minChar: number, limChar: number, newText: string): void {
            // Apply edits
            var prefix = content.substring(0, minChar);
            var middle = newText;
            var suffix = content.substring(limChar);
            content = prefix + middle + suffix;
            _lineStartIsDirty = true;
            

            // Store edit range + new length of script
            editRanges.push(new ts.TextChangeRange(
                ts.TextSpan.fromBounds(minChar, limChar),
                newText.length
                ));

            // Update version #
            scriptVersion++;
        }

        /**
         * Retrieve the script `_lineStarts`, recompute them if needed.
         */
        function getScriptSnapshot(): ts.IScriptSnapshot {
            // save the state of the script
            var lineStarts = getLineStarts();
            var textSnapshot = content;
            var snapshotVersion = scriptVersion;
            var snapshotRanges = editRanges.slice();
            
            /**
             * Retrieve the edits history between two script snapshot.
             * 
             * @param oldSnapshot the old snapshot to compare this one with.
             */
            function getChangeRange(oldSnapshot: ts.IScriptSnapshot): ts.TextChangeRange {
                var scriptVersion: number = (<any>oldSnapshot).version || 0;
                if (scriptVersion === snapshotVersion) {
                    return ts.TextChangeRange.unchanged;
                }
                var initialEditRangeIndex = snapshotRanges.length - (snapshotVersion - scriptVersion);

                if (initialEditRangeIndex < 0) {
                    return null;
                }

                var entries = snapshotRanges.slice(initialEditRangeIndex);
                return ts.TextChangeRange.collapseChangesAcrossMultipleVersions(entries);
            }

            return {
                getText: (start, end) => textSnapshot.substring(start, end),
                getLength: () => textSnapshot.length,
                getChangeRange,
                getLineStartPositions: () => lineStarts,
                version: snapshotVersion
            }
        }

        return {
            getContent: () => content,
            getVersion: () => scriptVersion,
            getIsOpen: () => isOpen,
            setIsOpen: val => isOpen = val,
            getEditRanges: () => editRanges,
            getLineStarts,
            getScriptSnapshot,

            updateContent,
            editContent
        }
    }
}


export = LanguageServiceHost;
