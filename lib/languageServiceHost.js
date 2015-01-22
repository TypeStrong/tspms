'use strict';
var ts = require('typescript');
var utils = require('./utils');
var console = require('./logger');
var LanguageServiceHost;
(function (LanguageServiceHost) {
    function create(baseDir, defaultLibFileName) {
        /**
         * compilationSettings
         */
        var compilationSettings;
        /**
         * a map associating file absolute path to ScriptInfo
         */
        var fileNameToScript = Object.create(null);
        /**
         * add a script to the host
         *
         * @param fileName the absolute path of the file
         * @param content the file content
         */
        function addScript(fileName, content) {
            var script = createScriptInfo(fileName, content);
            fileNameToScript[fileName] = script;
        }
        /**
         * remove a script from the host
         *
         * @param fileName the absolute path of the file
         */
        function removeScript(fileName) {
            delete fileNameToScript[fileName];
        }
        /**
         * remove all script from the host
         *
         * @param fileName the absolute path of the file
         */
        function removeAll() {
            fileNameToScript = Object.create(null);
        }
        /**
         * update a script
         *
         * @param fileName the absolute path of the file
         * @param content the new file content
         */
        function updateScript(fileName, content) {
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
        function editScript(fileName, minChar, limChar, newText) {
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
        function setScriptIsOpen(fileName, isOpen) {
            var script = fileNameToScript[fileName];
            if (script) {
                script.setIsOpen(isOpen);
                return;
            }
            throw new Error('No script with name \'' + fileName + '\'');
        }
        /**
         * the the language service host compilation settings
         *
         * @param the settings to be applied to the host
         */
        function setCompilationSettings(settings) {
            compilationSettings = Object.freeze(utils.clone(settings));
        }
        /**
         * retrieve the content of a given script
         *
         * @param fileName the absolute path of the file
         */
        function getScriptContent(fileName) {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getContent();
            }
            return null;
        }
        /**
         * return an index from a positon in line/char
         *
         * @param path the path of the file
         * @param position the position
         */
        function getIndexFromPosition(fileName, position) {
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
        function getPositionFromIndex(fileName, index) {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getLineAndColForPositon(index);
            }
            return null;
        }
        function getCompilationSettings() {
            return compilationSettings;
        }
        function getScriptFileNames() {
            return Object.keys(fileNameToScript);
        }
        function getScriptVersion(fileName) {
            var script = fileNameToScript[fileName];
            if (script) {
                return '' + script.getVersion();
            }
            return '0';
        }
        function getScriptIsOpen(fileName) {
            var script = fileNameToScript[fileName];
            if (script) {
                return script.getIsOpen();
            }
            return false;
        }
        function getScriptSnapshot(fileName) {
            var script = fileNameToScript[fileName];
            if (script) {
                return getScriptSnapShot(script);
            }
            return null;
        }
        function getCurrentDirectory() {
            return baseDir;
        }
        function getDefaultLibFilename() {
            return defaultLibFileName;
        }
        return {
            //ts.Logger implementation, actually master implementation instead of 1.4.1
            log: console.info,
            error: console.error,
            trace: console.info,
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
            getCurrentDirectory: getCurrentDirectory,
            getDefaultLibFilename: getDefaultLibFilename
        };
    }
    LanguageServiceHost.create = create;
    /**
     * Manage a script in the language service host
     */
    function createScriptInfo(fileName, content, isOpen) {
        if (isOpen === void 0) { isOpen = false; }
        var version = 1;
        var editRanges = [];
        var _lineStarts;
        var _lineStartIsDirty = true;
        function getLineStarts() {
            if (_lineStartIsDirty) {
                _lineStarts = ts.computeLineStarts(content);
                _lineStartIsDirty = false;
            }
            return _lineStarts;
        }
        /**
         * update the content of the script
         *
         * @param newContent the new script content
         */
        function updateContent(newContent) {
            content = newContent;
            _lineStartIsDirty = true;
            editRanges = [];
            version++;
        }
        /**
         * edit the script content
         *
         * @param minChar the index in the file content where the edition begins
         * @param limChar the index  in the file content where the edition ends
         * @param newText the text inserted
         */
        function editContent(minChar, limChar, newText) {
            // Apply edits
            var prefix = content.substring(0, minChar);
            var middle = newText;
            var suffix = content.substring(limChar);
            content = prefix + middle + suffix;
            _lineStartIsDirty = true;
            // Store edit range + new length of script
            editRanges.push(new ts.TextChangeRange(ts.TextSpan.fromBounds(minChar, limChar), newText.length));
            // Update version #
            version++;
        }
        /**
         * return an index position from line an character position
         *
         * @param line line number
         * @param character charecter poisiton in the line
         */
        function getPositionFromLine(line, ch) {
            return getLineStarts()[line] + ch;
        }
        /**
         * return line and chararacter position from index position
         *
         * @param position
         */
        function getLineAndColForPositon(position) {
            if (position < 0 || position > content.length) {
                throw new RangeError('Argument out of range: position');
            }
            var lineStarts = getLineStarts();
            var lineNumber = utils.binarySearch(lineStarts, position);
            if (lineNumber < 0) {
                lineNumber = (~lineNumber) - 1;
            }
            return {
                line: lineNumber,
                ch: position - lineStarts[lineNumber]
            };
        }
        return {
            getFileName: function () { return fileName; },
            getContent: function () { return content; },
            getVersion: function () { return version; },
            getIsOpen: function () { return isOpen; },
            setIsOpen: function (val) { return isOpen = val; },
            getEditRanges: function () { return editRanges; },
            getLineStarts: getLineStarts,
            updateContent: updateContent,
            editContent: editContent,
            getPositionFromLine: getPositionFromLine,
            getLineAndColForPositon: getLineAndColForPositon
        };
    }
    function getScriptSnapShot(scriptInfo) {
        var lineStarts = scriptInfo.getLineStarts();
        var textSnapshot = scriptInfo.getContent();
        var version = scriptInfo.getVersion();
        var editRanges = scriptInfo.getEditRanges();
        function getChangeRange(oldSnapshot) {
            var scriptVersion = oldSnapshot.version || 0;
            if (scriptVersion === version) {
                return ts.TextChangeRange.unchanged;
            }
            var initialEditRangeIndex = editRanges.length - (version - scriptVersion);
            if (initialEditRangeIndex < 0) {
                return null;
            }
            var entries = editRanges.slice(initialEditRangeIndex);
            return ts.TextChangeRange.collapseChangesAcrossMultipleVersions(entries);
        }
        return {
            getText: function (start, end) { return textSnapshot.substring(start, end); },
            getLength: function () { return textSnapshot.length; },
            getChangeRange: getChangeRange,
            getLineStartPositions: function () { return lineStarts; },
            version: version
        };
    }
})(LanguageServiceHost || (LanguageServiceHost = {}));
module.exports = LanguageServiceHost;
