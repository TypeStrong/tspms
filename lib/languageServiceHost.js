'use strict';
var ts = require('typescript');
var utils = require('./utils');
var console = require('./logger');
var LanguageServiceHost;
(function (LanguageServiceHost) {
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
    function create(currentDir, defaultLibFileName) {
        /**
         * CompilationSettings;
         */
        var compilationSettings;
        /**
         * A map associating absolute file name to ScriptInfo.
         */
        var fileNameToScript = Object.create(null);
        /**
         * Add a script to the LanguageServiceHost.
         *
         * @param fileName the absolute path of the file.
         * @param content the file content.
         */
        function addScript(fileName, content) {
            var script = createScriptInfo(content);
            fileNameToScript[fileName] = script;
        }
        /**
         * Remove a script from the LanguageServiceHost.
         *
         * @param fileName the absolute path of the file.
         */
        function removeScript(fileName) {
            delete fileNameToScript[fileName];
        }
        /**
         * Remove all script from the LanguageServiceHost.
         *
         * @param fileName the absolute path of the file.
         */
        function removeAll() {
            fileNameToScript = Object.create(null);
        }
        /**
         * Update a script.
         *
         * @param fileName the absolute path of the file.
         * @param content the new file content.
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
         * Edit a script.
         *
         * @param fileName the absolute path of the file
         * @param minChar the index in the file content where the edition begins.
         * @param limChar the index  in the file content where the edition ends.
         * @param newText the text inserted.
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
         * Set the `isOpen` status of a script.
         *
         * @param fileName the absolute file name.
         * @param isOpen open status.
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
         * Set the language service host compilation settings.
         *
         * @param the settings to be applied to the host
         */
        function setCompilationSettings(settings) {
            compilationSettings = Object.freeze(utils.clone(settings));
        }
        /**
         * Retrieve the content of a given script.
         *
         * @param fileName the absolute path of the file.
         */
        function getScriptContent(fileName) {
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
        function getScriptVersion(fileName) {
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
        function getScriptIsOpen(fileName) {
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
        function getScriptSnapshot(fileName) {
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
            addScript: addScript,
            removeScript: removeScript,
            removeAll: removeAll,
            updateScript: updateScript,
            editScript: editScript,
            getScriptContent: getScriptContent,
            setCompilationSettings: setCompilationSettings,
            setScriptIsOpen: setScriptIsOpen,
            // ts.LanguageServiceHost implementation
            getCompilationSettings: function () { return compilationSettings; },
            getScriptFileNames: function () { return Object.keys(fileNameToScript); },
            getCurrentDirectory: function () { return currentDir; },
            getDefaultLibFilename: function () { return defaultLibFileName; },
            getScriptVersion: getScriptVersion,
            getScriptIsOpen: getScriptIsOpen,
            getScriptSnapshot: getScriptSnapshot,
        };
    }
    LanguageServiceHost.create = create;
    /**
     * ScriptInfo factory.
     *
     * @param content the content of the file associated to this script.
     */
    function createScriptInfo(content) {
        /**
         * The script current version.
         */
        var scriptVersion = 1;
        /**
         * The script edit history.
         */
        var editRanges = [];
        /**
         * the `isOpen` status of the Script
         */
        var isOpen = false;
        /**
         * An array mapping the start of lines in the script to their position in the file.
         */
        var _lineStarts;
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
        function updateContent(newContent) {
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
            scriptVersion++;
        }
        /**
         * Retrieve the script `_lineStarts`, recompute them if needed.
         */
        function getScriptSnapshot() {
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
            function getChangeRange(oldSnapshot) {
                var scriptVersion = oldSnapshot.version || 0;
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
                getText: function (start, end) { return textSnapshot.substring(start, end); },
                getLength: function () { return textSnapshot.length; },
                getChangeRange: getChangeRange,
                getLineStartPositions: function () { return lineStarts; },
                version: snapshotVersion
            };
        }
        return {
            getContent: function () { return content; },
            getVersion: function () { return scriptVersion; },
            getIsOpen: function () { return isOpen; },
            setIsOpen: function (val) { return isOpen = val; },
            getEditRanges: function () { return editRanges; },
            getLineStarts: getLineStarts,
            getScriptSnapshot: getScriptSnapshot,
            updateContent: updateContent,
            editContent: editContent
        };
    }
})(LanguageServiceHost || (LanguageServiceHost = {}));
module.exports = LanguageServiceHost;
