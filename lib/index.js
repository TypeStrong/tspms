'use strict';
var promise = require('./promise');
var ProjectManager = require('./projectManager');
var fs = require('./fileSystem');
var ws = require('./workingSet');
var serviceUtils = require('./serviceUtils');
var console = require('./logger');
var utils = require('./utils');
exports.injectLogger = console.injectLogger;
//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------
exports.injectPromiseLibrary = promise.injectPromiseLibrary;
exports.Signal = utils.Signal;
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
function tsSpanToTextSpan(span) {
    return {
        start: span.start(),
        length: span.length()
    };
}
/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 *
 * @param fileName the absolute path of the file
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
        var languageService = project.getLanguageService(), completionInfo = languageService.getCompletionsAtPosition(fileName, position), typeScriptEntries = completionInfo && completionInfo.entries;
        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }
        var match;
        var sourceFile = languageService.getSourceFile(fileName);
        var typeScript = project.getTypeScriptInfo().typeScript;
        var word = serviceUtils.getTouchingWord(sourceFile, position, typeScript);
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
        }).slice(skip, limit + skip).map(function (typeScriptEntry) { return languageService.getCompletionEntryDetails(fileName, position, typeScriptEntry.name); });
        return {
            entries: completionEntries,
            match: match
        };
    });
}
exports.getCompletionAtPosition = getCompletionAtPosition;
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
function getRenameInfo(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        var info = languageService.getRenameInfo(fileName, position);
        return {
            canRename: info.canRename,
            localizedErrorMessage: info.localizedErrorMessage,
            displayName: info.displayName,
            fullDisplayName: info.fullDisplayName,
            kind: info.kind,
            kindModifiers: info.kindModifiers,
            triggerSpan: tsSpanToTextSpan(info.triggerSpan)
        };
    });
}
exports.getRenameInfo = getRenameInfo;
//--------------------------------------------------------------------------
//  getRenameInfo
//--------------------------------------------------------------------------
function findRenameLocations(fileName, position, findInStrings, findInComments) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.findRenameLocations(fileName, position, findInStrings, findInComments).map(function (location) { return ({
            textSpan: tsSpanToTextSpan(location.textSpan),
            fileName: location.fileName
        }); });
    });
}
exports.findRenameLocations = findRenameLocations;
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
function getReferencesAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getReferencesAtPosition(fileName, position).map(function (ref) { return ({
            fileName: ref.fileName,
            textSpan: tsSpanToTextSpan(ref.textSpan),
            isWriteAccess: ref.isWriteAccess
        }); });
    });
}
exports.getReferencesAtPosition = getReferencesAtPosition;
//--------------------------------------------------------------------------
//  getOccurrencesAtPosition
//--------------------------------------------------------------------------
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
function getNavigateToItems(fileName, search) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
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
    });
}
exports.getNavigateToItems = getNavigateToItems;
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
function getNavigationBarItems(fileName) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getNavigationBarItems(fileName).map(tsNavigationBarItemToNavigationBarItem);
    });
}
exports.getNavigationBarItems = getNavigationBarItems;
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
//  getEmitOutput
//--------------------------------------------------------------------------
function getEmitOutput(fileName) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService();
        return languageService.getEmitOutput(fileName);
    });
}
exports.getEmitOutput = getEmitOutput;
