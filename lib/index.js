'use strict';
var promise = require('./promise');
var ProjectManager = require('./projectManager');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var serviceUtils = require('./serviceUtils');
//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------
function injectPromiseLibrary(lib) {
    promise.injectPromiseLibrary(lib);
}
exports.injectPromiseLibrary = injectPromiseLibrary;
//--------------------------------------------------------------------------
//  init
//--------------------------------------------------------------------------
/**
 * Initializate the service
 *
 * @param config the config used for the project managed
 */
function init(config) {
    return ProjectManager.init(config);
}
exports.init = init;
//--------------------------------------------------------------------------
//  updateProjectConfigs
//--------------------------------------------------------------------------
/**
 * Update the configurations of the projects managed by this services.
 *
 * @param configs
 *   A map project name to project config file.
 *   if a project previously managed by this service is not present in the  map
 *   the project will be disposed.
 *   If a new project is present in the map, the project will be initialized
 *   Otherwise the project will be updated accordingly to the new configuration
 */
function updateProjectConfigs(configs) {
    return ProjectManager.updateProjectConfigs(configs);
}
exports.updateProjectConfigs = updateProjectConfigs;
/**
 * dispose the service
 */
function dispose() {
    ProjectManager.dispose();
}
exports.dispose = dispose;
//--------------------------------------------------------------------------
//  getDefinitionAtPosition
//--------------------------------------------------------------------------
/**
 * Retrieve definition info of a symbol at a given position in a given file.
 * return a promise resolving to a list of definition info.
 *
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve definition info
 *
 */
function getDefinitionAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService(), languageServiceHost = project.getLanguageServiceHost(), index = languageServiceHost.getIndexFromPosition(fileName, position);
        if (index < 0) {
            return [];
        }
        return languageService.getDefinitionAtPosition(fileName, index).map(function (definition) {
            var startPos = languageServiceHost.getPositionFromIndex(definition.fileName, definition.textSpan.start()), endPos = languageServiceHost.getPositionFromIndex(definition.fileName, definition.textSpan.end());
            return {
                name: (definition.containerName ? (definition.containerName + '.') : '') + definition.name,
                lineStart: startPos.line,
                charStart: startPos.ch,
                lineEnd: endPos.line,
                charEnd: endPos.ch,
                fileName: definition.fileName
            };
        });
    }).catch(function () { return []; });
}
exports.getDefinitionAtPosition = getDefinitionAtPosition;
//--------------------------------------------------------------------------
//
//  Error service
//
//--------------------------------------------------------------------------
//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------
(function (DiagnosticCategory) {
    DiagnosticCategory[DiagnosticCategory["Warning"] = 0] = "Warning";
    DiagnosticCategory[DiagnosticCategory["Error"] = 1] = "Error";
    DiagnosticCategory[DiagnosticCategory["Message"] = 2] = "Message";
})(exports.DiagnosticCategory || (exports.DiagnosticCategory = {}));
var DiagnosticCategory = exports.DiagnosticCategory;
//--------------------------------------------------------------------------
//  getErrorsForFile
//--------------------------------------------------------------------------
/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 *
 * @param fileName the absolute path of the file
 */
function getErrorsForFile(fileName) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService(), languageServiceHost = project.getLanguageServiceHost(), diagnostics = languageService.getSyntacticDiagnostics(fileName);
        if (diagnostics.length === 0) {
            diagnostics = languageService.getSemanticDiagnostics(fileName);
        }
        return diagnostics.map(function (diagnostic) { return ({
            pos: languageServiceHost.getPositionFromIndex(fileName, diagnostic.start),
            endPos: languageServiceHost.getPositionFromIndex(fileName, diagnostic.length + diagnostic.start),
            message: diagnostic.messageText,
            type: diagnostic.category
        }); });
    }).catch(function () { return []; });
}
exports.getErrorsForFile = getErrorsForFile;
//--------------------------------------------------------------------------
//  getFormatingForFile
//--------------------------------------------------------------------------
/**
 * Retrieve formating information for a givent file.
 * return a promise resolving to a list of TextEdit
 *
 * @param fileName the absolute path of the file
 * @param options formation options
 * @param startPos an option start position for the formating range
 * @param endPos an optional end position for the formating range
 *
 */
function getFormatingForFile(fileName, options, startPos, endPos) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageServiceHost = project.getLanguageServiceHost(), languageService = project.getLanguageService(), minChar, limChar;
        if (!startPos || !endPos) {
            minChar = 0;
            limChar = project.getLanguageServiceHost().getScriptContent(fileName).length - 1;
        }
        else {
            minChar = languageServiceHost.getIndexFromPosition(fileName, startPos);
            limChar = languageServiceHost.getIndexFromPosition(fileName, endPos);
        }
        var result = languageService.getFormattingEditsForRange(fileName, minChar, limChar, options).map(function (textChange) { return ({
            start: textChange.span.start(),
            end: textChange.span.end(),
            newText: textChange.newText
        }); });
        return result && result.reverse();
    });
}
exports.getFormatingForFile = getFormatingForFile;
//--------------------------------------------------------------------------
//  getCompletionAtPosition
//--------------------------------------------------------------------------
/**
 * Retrieve completion proposal at a given point in a given file.
 * return a promise resolving to a list of completion proposals.
 *
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve completion proposal
 * @param limit the max number of proposition this service shoudl return
 * @param skip the number of proposition this service should skip
 *
 */
function getCompletionAtPosition(fileName, position, limit, skip) {
    if (limit === void 0) { limit = 50; }
    if (skip === void 0) { skip = 0; }
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService(), languageServiceHost = project.getLanguageServiceHost(), index = languageServiceHost.getIndexFromPosition(fileName, position), completionInfo = languageService.getCompletionsAtPosition(fileName, index), typeScriptEntries = completionInfo && completionInfo.entries;
        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }
        var match;
        var sourceFile = languageService.getSourceFile(fileName);
        var typeScript = project.getTypeScriptInfo().typeScript;
        var word = serviceUtils.getTouchingWord(sourceFile, index, typeScript);
        if (word && serviceUtils.isWord(word.kind, typeScript)) {
            match = word.getText();
            typeScriptEntries = typeScriptEntries.filter(function (entry) {
                return entry.name && entry.name.toLowerCase().indexOf(match.toLowerCase()) === 0;
            });
        }
        var completionEntries = typeScriptEntries.sort(function (entry1, entry2) {
            var match1 = entry1 ? entry1.name.indexOf(match) : -1, match2 = entry2 ? entry2.name.indexOf(match) : -1;
            if (match1 === 0 && match2 !== 0) {
                return -1;
            }
            else if (match2 === 0 && match1 !== 0) {
                return 1;
            }
            else {
                var name1 = entry1 && entry1.name.toLowerCase(), name2 = entry2 && entry2.name.toLowerCase();
                if (name1 < name2) {
                    return -1;
                }
                else if (name1 > name2) {
                    return 1;
                }
                else {
                    return 0;
                }
            }
        }).slice(skip, limit + skip).map(function (typeScriptEntry) { return languageService.getCompletionEntryDetails(fileName, index, typeScriptEntry.name); });
        return {
            entries: completionEntries,
            match: match
        };
    }).catch(function () { return ({
        entries: [],
        match: ''
    }); });
}
exports.getCompletionAtPosition = getCompletionAtPosition;
