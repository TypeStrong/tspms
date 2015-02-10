'use strict';
var promise = require('./promise');
var ProjectManager = require('./projectManager');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var serviceUtils = require('./serviceUtils');
var Logger = require('./logger');
var utils = require('./utils');
//--------------------------------------------------------------------------
//
//  Logger Injection
//
//--------------------------------------------------------------------------
/**
 * Let the user inject logger used by the service.
 *
 * @param info information logger.
 * @param warn warning logger.
 * @param error error logger.
 */
exports.injectLogger = Logger.injectLogger;
//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------
/**
 * Let the user inject Promise library used by the service,
 * it must be an es6 spec comliant promise library
 *
 * @param promise the Promise constructor of the injected library.
 */
exports.injectPromiseLibrary = promise.injectPromiseLibrary;
//--------------------------------------------------------------------------
//  init
//--------------------------------------------------------------------------
/**
 * Initializate the service.
 *
 * @param config the main service configuration
 */
function init(config) {
    return ProjectManager.init(config);
}
exports.init = init;
//--------------------------------------------------------------------------
//  updateProjectConfigs
//--------------------------------------------------------------------------
/**
 * Update the configurations of the projects managed by this service.
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
 * Dispose the service.
 */
function dispose() {
    ProjectManager.dispose();
}
exports.dispose = dispose;
/**
 * Convert a TextSpan in typescript compiler format to raw json format.
 * Since depending of the version of the language service
 *
 * @param span the text span to convert.
 */
function tsSpanToTextSpan(span) {
    var start;
    var length;
    if (typeof span.start === 'function') {
        start = span.start();
        length = span.length();
    }
    else {
        start = span.start;
        length = span.length;
    }
    return { start: start, length: length };
}
/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 *
 * @param fileName the absolute file name
 * @param allErrors by default errors are checked in 3 phases, options check, syntax check,
 *   semantic check, is allErrors is set to false, the service won't check the nex phase
 *   if there is error in the precedent one
 */
function getDiagnosticsForFile(fileName, allErrors) {
    if (allErrors === void 0) { allErrors = false; }
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        var diagnostics = languageService.getCompilerOptionsDiagnostics();
        if (diagnostics.length === 0 || allErrors) {
            diagnostics = languageService.getSyntacticDiagnostics(fileName);
        }
        if (diagnostics.length === 0 || allErrors) {
            diagnostics = languageService.getSemanticDiagnostics(fileName);
        }
        return diagnostics.map(function (diagnostic) { return ({
            fileName: fileName,
            start: diagnostic.start,
            length: diagnostic.length,
            messageText: diagnostic.messageText,
            category: diagnostic.category,
            code: diagnostic.code
        }); });
    });
}
exports.getDiagnosticsForFile = getDiagnosticsForFile;
/**
 * Retrieve completion proposal at a given point in a given file.
 * return a promise resolving to a list of completion proposals.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the completion is requested.
 * @param limit the max number of proposition this service shoudl return.
 * @param skip the number of proposition this service should skip.
 *
 */
function getCompletionAtPosition(fileName, position, limit, skip) {
    if (limit === void 0) { limit = 50; }
    if (skip === void 0) { skip = 0; }
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService(), completionInfo = languageService.getCompletionsAtPosition(fileName, position), typeScriptEntries = completionInfo && completionInfo.entries;
        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }
        var match;
        var sourceFile = languageService.getSourceFile(fileName);
        var ts = project.getTypeScriptInfo().ts;
        var word = serviceUtils.getTouchingWord(sourceFile, position, ts);
        if (word && serviceUtils.isWord(word.kind, ts)) {
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
        }).slice(skip, limit + skip).map(function (typeScriptEntry) { return languageService.getCompletionEntryDetails(fileName, position, typeScriptEntry.name); });
        return {
            entries: completionEntries,
            match: match
        };
    });
}
exports.getCompletionAtPosition = getCompletionAtPosition;
/**
 * Retrieve information about type/documentation for the givent file name at the given position.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
function getQuickInfoAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        var info = languageService.getQuickInfoAtPosition(fileName, position);
        return {
            kind: info.kind,
            kindModifiers: info.kindModifiers,
            textSpan: tsSpanToTextSpan(info.textSpan),
            displayParts: info.displayParts,
            documentation: info.documentation
        };
    });
}
exports.getQuickInfoAtPosition = getQuickInfoAtPosition;
/**
 * Retrieve signature information about a function being called.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the informations are requested.
 */
function getSignatureHelpItems(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        var signature = languageService.getSignatureHelpItems(fileName, position);
        return {
            items: signature.items,
            applicableSpan: tsSpanToTextSpan(signature.applicableSpan),
            selectedItemIndex: signature.selectedItemIndex,
            argumentIndex: signature.argumentIndex,
            argumentCount: signature.argumentCount
        };
    });
}
exports.getSignatureHelpItems = getSignatureHelpItems;
/**
 * Retrieve rename informations about a symbol at a given position.
 * This method will look into all the projects, and returns the first positive renameInfo found.
 *
 * @param fileName the absolute file name.
 * @param position the position in the file where the rename informations are requested.
 */
function getRenameInfo(fileName, position) {
    return ProjectManager.getAllProjectsForFile(fileName).then(function (projects) {
        for (var i = 0; i < projects.length; i++) {
            var project = projects[i];
            var languageService = project.getLanguageService();
            var info = languageService.getRenameInfo(fileName, position);
            if (info && info.canRename || i === projects.length - 1) {
                return {
                    canRename: info.canRename,
                    localizedErrorMessage: info.localizedErrorMessage,
                    displayName: info.displayName,
                    fullDisplayName: info.fullDisplayName,
                    kind: info.kind,
                    kindModifiers: info.kindModifiers,
                    triggerSpan: tsSpanToTextSpan(info.triggerSpan)
                };
            }
        }
    });
}
exports.getRenameInfo = getRenameInfo;
//--------------------------------------------------------------------------
//  getRenameInfo
//--------------------------------------------------------------------------
/**
 * Retrieve locations where a rename must occurs.
 * This methods apply to all the project that manage the given file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol to rename.
 * @param findInComments if true the service will also look into comments.
 */
function findRenameLocations(fileName, position, findInStrings, findInComments) {
    return ProjectManager.getAllProjectsForFile(fileName).then(function (projects) {
        return utils.flatten(projects.map(function (project) {
            var languageService = project.getLanguageService();
            return languageService.findRenameLocations(fileName, position, findInStrings, findInComments).map(function (location) { return ({
                textSpan: tsSpanToTextSpan(location.textSpan),
                fileName: location.fileName
            }); });
        })).filter(function (info, index, array) {
            return array.slice(index + 1).every(function (info1) { return (info1.fileName !== info.fileName || info1.textSpan.start !== info.textSpan.start); });
        });
    });
}
exports.findRenameLocations = findRenameLocations;
/**
 * Retrieve informations about a typescript definition.
 *
 * @param fileName the absolute file name.
 * @param position the position of the definition in the file.
 */
function getDefinitionAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getDefinitionAtPosition(fileName, position).map(function (def) { return ({
            fileName: def.fileName,
            textSpan: tsSpanToTextSpan(def.textSpan),
            kind: def.kind,
            name: def.name,
            containerKind: def.containerKind,
            containerName: def.containerName
        }); });
    });
}
exports.getDefinitionAtPosition = getDefinitionAtPosition;
/**
 * Retrieve a symbol references accros a project.
 * This method look into every project that manage the given file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
function getReferencesAtPosition(fileName, position) {
    return ProjectManager.getAllProjectsForFile(fileName).then(function (projects) {
        return utils.flatten(projects.map(function (project) {
            var languageService = project.getLanguageService();
            return languageService.getReferencesAtPosition(fileName, position).map(function (ref) { return ({
                fileName: ref.fileName,
                textSpan: tsSpanToTextSpan(ref.textSpan),
                isWriteAccess: ref.isWriteAccess
            }); });
        })).filter(function (info, index, array) {
            return array.slice(index + 1).every(function (info1) { return (info1.fileName !== info.fileName || info1.textSpan.start !== info.textSpan.start); });
        });
    });
}
exports.getReferencesAtPosition = getReferencesAtPosition;
//--------------------------------------------------------------------------
//  getOccurrencesAtPosition
//--------------------------------------------------------------------------
/**
 * Retrieve a symbol references accros a file.
 *
 * @param fileName the absolute file name.
 * @param position the position of the symbol.
 */
function getOccurrencesAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getOccurrencesAtPosition(fileName, position).map(function (ref) { return ({
            fileName: ref.fileName,
            textSpan: tsSpanToTextSpan(ref.textSpan),
            isWriteAccess: ref.isWriteAccess
        }); });
    });
}
exports.getOccurrencesAtPosition = getOccurrencesAtPosition;
/**
 * Retrieve information about navigation between files of the project
 *
 * @param position the searched string.
 */
function getNavigateToItems(search) {
    return ProjectManager.getAllProjects().then(function (projects) {
        return utils.flatten(projects.map(function (project) {
            var languageService = project.getLanguageService();
            return languageService.getNavigateToItems(search).map(function (item) { return ({
                name: item.name,
                kind: item.kind,
                kindModifiers: item.kindModifiers,
                matchKind: item.matchKind,
                fileName: item.fileName,
                textSpan: tsSpanToTextSpan(item.textSpan),
                containerName: item.containerName,
                containerKind: item.containerKind
            }); });
        })).filter(function (info, index, array) {
            return array.slice(index + 1).every(function (info1) { return (info1.fileName !== info.fileName || info1.textSpan.start !== info.textSpan.start); });
        });
    });
}
exports.getNavigateToItems = getNavigateToItems;
/**
 * Convert a typescript navigation bar item to raw json format.
 */
function tsNavigationBarItemToNavigationBarItem(item) {
    return {
        text: item.text,
        kind: item.kind,
        kindModifiers: item.kindModifiers,
        indent: item.indent,
        bolded: item.bolded,
        grayed: item.grayed,
        spans: item.spans && item.spans.map(tsSpanToTextSpan),
        childItems: item.childItems && item.childItems.map(tsNavigationBarItemToNavigationBarItem)
    };
}
/**
 * Retrieve navigation bar for the givent file
 *
 * @param fileName the absolute file name.
 */
function getNavigationBarItems(fileName) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getNavigationBarItems(fileName).map(tsNavigationBarItemToNavigationBarItem);
    });
}
exports.getNavigationBarItems = getNavigationBarItems;
/**
 * Retrieve formating information for a file or range in a file.
 *
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param start if start and end are provided the formatting will only be applied on that range.
 * @param end if start and end are provided the formatting will only be applied on that range.
 */
function getFormattingEditsForFile(fileName, options, start, end) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        if (typeof start === 'number' && typeof end === 'number') {
            return languageService.getFormattingEditsForRange(fileName, start, end, options).map(function (edit) { return ({
                span: tsSpanToTextSpan(edit.span),
                newText: edit.newText
            }); });
        }
        else {
            return languageService.getFormattingEditsForDocument(fileName, options).map(function (edit) { return ({
                span: tsSpanToTextSpan(edit.span),
                newText: edit.newText
            }); });
        }
    });
}
exports.getFormattingEditsForFile = getFormattingEditsForFile;
//--------------------------------------------------------------------------
//  getFormattingEditsForRange
//--------------------------------------------------------------------------
/**
 * Retrieve formating information after a key stroke (use for auto formating)
 *
 * @param fileName the absolute file name.
 * @param options formatting options.
 * @param position the position where the key stroke occured.
 * @param key the key.
 */
function getFormattingEditsAfterKeyStroke(fileName, options, position, key) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getFormattingEditsAfterKeystroke(fileName, position, key, options).map(function (edit) { return ({
            span: tsSpanToTextSpan(edit.span),
            newText: edit.newText
        }); });
    });
}
exports.getFormattingEditsAfterKeyStroke = getFormattingEditsAfterKeyStroke;
//--------------------------------------------------------------------------
//  getEmitOutput
//--------------------------------------------------------------------------
/**
 * Retrieve emit output for a file name
 *
 * @param fileName the absolute file name.
 */
function getEmitOutput(fileName) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getEmitOutput(fileName);
    });
}
exports.getEmitOutput = getEmitOutput;
