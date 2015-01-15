//   Copyright 2013-2014 François de Campredon
//
//   Licensed under the Apache License, Version 2.0 (the "License");
//   you may not use this file except in compliance with the License.
//   You may obtain a copy of the License at
//
//       http://www.apache.org/licenses/LICENSE-2.0
//
//   Unless required by applicable law or agreed to in writing, software
//   distributed under the License is distributed on an "AS IS" BASIS,
//   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
//   See the License for the specific language governing permissions and
//   limitations under the License.

'use strict';

import ts     = require('typescript');
import path   = require('path');
import logger = require('./logger');
import utils  = require('./utils');


interface LanguageServiceHost extends ts.LanguageServiceHost {
    /**
     * add a script to the host
     * 
     * @param fileName the absolute path of the file
     * @param content the file content
     */
    addScript(fileName: string, content: string): void;
    
    /**
     * remove a script from the host
     * 
     * @param fileName the absolute path of the file
     */
    removeScript(fileName: string):void;
    
    /**
     * remove all script from the host
     * 
     * @param fileName the absolute path of the file
     */
    removeAll(): void;
    
    /**
     * update a script
     * 
     * @param fileName the absolute path of the file
     * @param content the new file content
     */
    updateScript(fileName: string, content: string): void;

    /**
     * edit a script
     * 
     * @param fileName the absolute path of the file
     * @param minChar the index in the file content where the edition begins
     * @param limChar the index  in the file content where the edition ends
     * @param newText the text inserted
     */
    editScript(fileName: string, minChar: number, limChar: number, newText: string): void;
    
    /**
     * set 'open' status of a script
     * 
     * @param fileName the absolute path of the file
     * @param isOpen open status
     */
    setScriptIsOpen(fileName: string, isOpen: boolean): void;
    
    /**
     * the the language service host compilation settings
     * 
     * @param the settings to be applied to the host
     */
    setCompilationSettings(settings: ts.CompilerOptions ): void;
    
    /**
     * retrieve the content of a given script
     * 
     * @param fileName the absolute path of the file
     */
    getScriptContent(fileName: string): string;
    
    /**
     * return an index from a positon in line/char
     * 
     * @param path the path of the file
     * @param position the position
     */
    getIndexFromPosition(fileName: string, position: {ch: number; line: number}): number;
    
    
    /**
     * return a positon in line/char from an index
     * 
     * @param path the path of the file
     * @param index the index
     */
    getPositionFromIndex(fileName: string, index: number): {ch: number; line: number};
}


module LanguageServiceHost {
    export function create(): LanguageServiceHost {

        /**
         * compilationSettings
         */
        var compilationSettings: ts.CompilerOptions;

        /**
         * a map associating file absolute path to ScriptInfo
         */
        var fileNameToScript: {[fileName: string]: ScriptInfo} = Object.create(null);

        /**
         * add a script to the host
         * 
         * @param fileName the absolute path of the file
         * @param content the file content
         */
        function addScript(fileName: string, content: string) {
            var script = new ScriptInfo(fileName, content);
            fileNameToScript[fileName] = script;
        }

        /**
         * remove a script from the host
         * 
         * @param fileName the absolute path of the file
         */
        function removeScript(fileName: string) {
            delete fileNameToScript[fileName];
        }

        /**
         * remove all script from the host
         * 
         * @param fileName the absolute path of the file
         */
        function removeAll(): void {
            fileNameToScript = Object.create(null);
        }

        /**
         * update a script
         * 
         * @param fileName the absolute path of the file
         * @param content the new file content
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
         * edit a script
         * 
         * @param fileName the absolute path of the file
         * @param minChar the index in the file content where the edition begins
         * @param limChar the index  in the file content where the edition ends
         * @param newText the text inserted
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
         * set 'open' status of a script
         * 
         * @param fileName the absolute path of the file
         * @param isOpen open status
         */
        function setScriptIsOpen(fileName: string, isOpen: boolean) {
            var script = fileNameToScript[fileName];
            if (script) {
                script.isOpen = isOpen;
                return;
            }

            throw new Error('No script with name \'' + fileName + '\'');
        }

        /**
         * the the language service host compilation settings
         * 
         * @param the settings to be applied to the host
         */
        function setCompilationSettings(settings: ts.CompilerOptions ): void{
            this.compilationSettings = Object.freeze(utils.clone(settings));
        }

        /**
         * retrieve the content of a given script
         * 
         * @param fileName the absolute path of the file
         */
        function getScriptContent(fileName: string): string {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.content;
            }
            return null;
        }

        /**
         * return an index from a positon in line/char
         * 
         * @param path the path of the file
         * @param position the position
         */
        function getIndexFromPosition(fileName: string, position: {ch: number; line: number}): number {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getPositionFromLine(position.line, position.ch);
            }
            return -1;
        }


        /**
         * return a positon in line/char from an index
         * 
         * @param path the path of the file
         * @param index the index
         */
        function getPositionFromIndex(fileName: string, index: number): {ch: number; line: number} {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getLineAndColForPositon(index);
            }
            return null;
        }


        function getCompilationSettings(): ts.CompilerOptions {
            return compilationSettings;
        }

        function getScriptFileNames(): string[] {
            return Object.keys(fileNameToScript);
        }

        function getScriptVersion(fileName: string): string {
            var script = fileNameToScript[fileName];
            if (script) {
                return '' + script.version;
            }
            return '0';
        }

        function getScriptIsOpen(fileName: string): boolean {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.isOpen;
            }
            return false;
        }

        function getScriptSnapshot(fileName: string): ts.IScriptSnapshot {
            var script = fileNameToScript[fileName];
            if (script) {
                return getScriptSnapShot(script);
            }
            return null;
        }

        function getLocalizedDiagnosticMessages(): any {
            return {};
        }

        function getCancellationToken(): ts.CancellationToken {
            //TODO
            return null;
        }
        
        function getCurrentDirectory(): string {
            //TODO
            return "";
        }
        
        function getDefaultLibFilename(): string {
            //TODO
            return "";
        }

        return {
            //ts.Logger implementation
            information: logger.information,
            debug: logger.debug,
            warning: logger.warning,
            error: logger.error,
            fatal: logger.fatal,
            log: logger.log,


            // LanguageServiceHost implementation

            addScript: addScript,
            removeScript: removeScript,
            removeAll: removeAll,
            updateScript: updateScript,
            editScript: editScript,
            getIndexFromPosition: getIndexFromPosition,
            getPositionFromIndex: getPositionFromIndex,
            getScriptContent: getScriptContent,
            setCompilationSettings: setCompilationSettings,
            setScriptIsOpen: setScriptIsOpen,


            // ts.LanguageServiceHost implementation
            getCompilationSettings: getCompilationSettings,
            getScriptFileNames: getScriptFileNames,
            getScriptVersion: getScriptVersion,
            getScriptIsOpen: getScriptIsOpen,
            getScriptSnapshot: getScriptSnapshot,
            getLocalizedDiagnosticMessages: getLocalizedDiagnosticMessages,
            getCancellationToken: getCancellationToken,
            getCurrentDirectory: getCurrentDirectory,
            getDefaultLibFilename: getDefaultLibFilename
        
        };
    }


    /**
     * Manage a script in the language service host
     */
    class ScriptInfo {
        version: number = 1;
        editRanges: ts.TextChangeRange[] = [];
        lineStarts: number[];
        fileName: string;
        content: string;
        isOpen: boolean;


        /**
         * @param fileName the absolute path of the file
         * @param content the content of the file
         * @param isOpen the open status of the script
         * @param byteOrderMark
         */
        constructor(fileName: string, content: string, isOpen = false) {
            this.fileName = fileName;
            this.content = content;
            this.isOpen = isOpen;
            this.setContent(content);
        }




        /**
         * update the content of the script
         * 
         * @param newContent the new script content
         */
        updateContent(newContent: string): void {
            this.setContent(newContent);
            this.editRanges = [];
            this.version++;
        }


        /**
         * edit the script content
         * 
         * @param minChar the index in the file content where the edition begins
         * @param limChar the index  in the file content where the edition ends
         * @param newText the text inserted
         */
        editContent(minChar: number, limChar: number, newText: string): void {
            // Apply edits
            var prefix = this.content.substring(0, minChar);
            var middle = newText;
            var suffix = this.content.substring(limChar);
            this.setContent(prefix + middle + suffix);

            // Store edit range + new length of script
            this.editRanges.push(new ts.TextChangeRange(
                ts.TextSpan.fromBounds(minChar, limChar), 
                newText.length
            ));

            // Update version #
            this.version++;
        }



        /**
         * return an index position from line an character position
         * 
         * @param line line number
         * @param character charecter poisiton in the line
         */
        getPositionFromLine(line: number, ch: number) {
            return this.lineStarts[line] + ch;
        }

        /**
         * return line and chararacter position from index position
         * 
         * @param position
         */
        getLineAndColForPositon(position: number) {
            if (position < 0 || position > this.content.length) {
                throw new RangeError('Argument out of range: position');
            }
            var lineNumber = binarySearch(this.lineStarts, position);
            if (lineNumber < 0) {
                lineNumber = (~lineNumber) - 1;
            }
            return  { 
                line: lineNumber, 
                ch: position - this.lineStarts[lineNumber]
            };
        }


        /**
         * set the script content
         */
        private setContent(content: string): void {
            this.content = content;
            this.lineStarts = ts.computeLineStarts(content);
        }
    }
    
    
    
    function getScriptSnapShot(scriptInfo: ScriptInfo): ts.IScriptSnapshot  {
        var lineStarts = scriptInfo.lineStarts;
        var textSnapshot = scriptInfo.content;
        var version = scriptInfo.version
        var editRanges = scriptInfo.editRanges
        
        function getText(start: number, end: number): string {
            return this.textSnapshot.substring(start, end);
        }

        function getLength(): number {
            return this.textSnapshot.length;
        }
        function getLineStartPositions(): number[] {
            return this.lineStarts;
        }


        function getChangeRange(oldSnapshot: ts.IScriptSnapshot): ts.TextChangeRange {
            var scriptVersion: number = (<any>oldSnapshot).version || 0;
            if (scriptVersion === this.version) {
                return ts.TextChangeRange.unchanged;
            }
            var initialEditRangeIndex = this.editRanges.length - (this.version - scriptVersion);

            if (initialEditRangeIndex < 0) {
                return null;
            }

            var entries = this.editRanges.slice(initialEditRangeIndex);
            return ts.TextChangeRange.collapseChangesAcrossMultipleVersions(entries);
        }
        
        return {
            getText: getText,
            getLength: getLength,
            getChangeRange: getChangeRange,
            getLineStartPositions: getLineStartPositions,
            version: version
        }
    }
    
    function binarySearch(array: number[], value: number): number {
        var low = 0;
        var high = array.length - 1;

        while (low <= high) {
            var middle = low + ((high - low) >> 1);
            var midValue = array[middle];

            if (midValue === value) {
                return middle;
            }
            else if (midValue > value) {
                high = middle - 1;
            }
            else {
                low = middle + 1;
            }
        }

        return ~low;
    }
}


export = LanguageServiceHost;
