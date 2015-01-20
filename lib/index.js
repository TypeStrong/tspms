var ts = require('typescript');
var ProjectManager = require('./projectManager');
//--------------------------------------------------------------------------
//
//  Initialization
//
//--------------------------------------------------------------------------
function init(config) {
    return ProjectManager.init(config);
}
exports.init = init;
function dispose() {
    ProjectManager.dispose();
}
exports.dispose = dispose;
/**
 * retrieve definition info of a symbol at a given position in a given file
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve definition info
 *
 * @return a promise resolving to a list of definition info
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
(function (DiagnosticCategory) {
    DiagnosticCategory[DiagnosticCategory["Warning"] = 0] = "Warning";
    DiagnosticCategory[DiagnosticCategory["Error"] = 1] = "Error";
    DiagnosticCategory[DiagnosticCategory["Message"] = 2] = "Message";
})(exports.DiagnosticCategory || (exports.DiagnosticCategory = {}));
var DiagnosticCategory = exports.DiagnosticCategory;
/**
 * Retrieve a list of errors for a given file
 * @param fileName the absolute path of the file
 *
 * @return a promise resolving to a list of errors
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
/**
 * Retrieve formating information for a givent file
 * @param fileName the absolute path of the file
 * @param options formation options
 * @param startPos an option start position for the formating range
 * @param endPos an optional end position for the formating range
 *
 * @return a promise resolving to a formating range info
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
            pos: languageServiceHost.getPositionFromIndex(fileName, textChange.span.start()),
            endPos: languageServiceHost.getPositionFromIndex(fileName, textChange.span.end() - textChange.span.start()),
            newText: textChange.newText
        }); });
        return result && result.reverse();
    });
}
exports.getFormatingForFile = getFormatingForFile;
//--------------------------------------------------------------------------
//
//  Completion service
//
//--------------------------------------------------------------------------
/**
 * An Enum representing the different kind of hint
 */
(function (CompletionKind) {
    /**
     * the completion entry correspond to a class name
     */
    CompletionKind[CompletionKind["CLASS"] = 0] = "CLASS";
    /**
     * the completion entry correspond to an interface name
     */
    CompletionKind[CompletionKind["INTERFACE"] = 1] = "INTERFACE";
    /**
     * the completion entry correspond to an enum name
     */
    CompletionKind[CompletionKind["ENUM"] = 2] = "ENUM";
    /**
     * the completion entry correspond to a module name
     */
    CompletionKind[CompletionKind["MODULE"] = 3] = "MODULE";
    /**
     * the completion entry correspond to a variable name
     */
    CompletionKind[CompletionKind["VARIABLE"] = 4] = "VARIABLE";
    /**
     * the completion entry correspond to a mehtod name
     */
    CompletionKind[CompletionKind["METHOD"] = 5] = "METHOD";
    /**
     * the completion entry correspond to a function
     */
    CompletionKind[CompletionKind["FUNCTION"] = 6] = "FUNCTION";
    /**
     * the completion entry correspond to a keyword
     */
    CompletionKind[CompletionKind["KEYWORD"] = 7] = "KEYWORD";
    /**
     * Any other type
     */
    CompletionKind[CompletionKind["DEFAULT"] = 8] = "DEFAULT";
})(exports.CompletionKind || (exports.CompletionKind = {}));
var CompletionKind = exports.CompletionKind;
/**
 * Retrieve completion proposal at a given point in a given file
 * @param fileName the absolute path of the file
 * @param position in the file where you want to retrieve completion proposal
 *
 * @return a promise resolving to a list of proposals
 */
function getCompletionAtPosition(fileName, position) {
    return ProjectManager.getProjectForFile(fileName).then(function (project) {
        var languageService = project.getLanguageService(), languageServiceHost = project.getLanguageServiceHost(), index = languageServiceHost.getIndexFromPosition(fileName, position), completionInfo = languageService.getCompletionsAtPosition(fileName, index), typeScriptEntries = completionInfo && completionInfo.entries;
        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }
        var match;
        //TODO
        //        
        //        var sourceUnit = languageService.getSourceFile(fileName).getSourceFile(),
        //            currentToken = TypeScript.Syntax.findTokenOnLeft(sourceUnit, index),
        //            match: string;
        //
        //        if (currentToken && this.isValidTokenKind(currentToken.kind())) {
        //            match = currentToken.fullText();
        //            if (currentToken.leadingTrivia()) {
        //                match = match.substr(currentToken.leadingTriviaWidth());
        //            }
        //
        //            if (currentToken.trailingTrivia()) {
        //                match = match.substr(0, match.length - currentToken.trailingTriviaWidth());
        //            }
        //
        //            typeScriptEntries = typeScriptEntries.filter(entry => {
        //                return entry.name && entry.name.toLowerCase().indexOf(match.toLowerCase()) === 0;
        //            });
        //        }
        typeScriptEntries.sort(function (entry1, entry2) {
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
        });
        var completionEntries = typeScriptEntries.map(function (typeScriptEntry) {
            var entryInfo = languageService.getCompletionEntryDetails(fileName, index, typeScriptEntry.name), 
            //TODO
            completionEntry = {
                name: typeScriptEntry.name,
                kind: 8 /* DEFAULT */,
                type: entryInfo && '',
                doc: entryInfo && '' //&& entryInfo.docComment
            };
            switch (typeScriptEntry.kind) {
                case ts.ScriptElementKind.unknown:
                case ts.ScriptElementKind.primitiveType:
                case ts.ScriptElementKind.scriptElement:
                    break;
                case ts.ScriptElementKind.keyword:
                    completionEntry.kind = 7 /* KEYWORD */;
                    break;
                case ts.ScriptElementKind.classElement:
                    completionEntry.kind = 0 /* CLASS */;
                    break;
                case ts.ScriptElementKind.interfaceElement:
                    completionEntry.kind = 1 /* INTERFACE */;
                    break;
                case ts.ScriptElementKind.enumElement:
                    completionEntry.kind = 2 /* ENUM */;
                    break;
                case ts.ScriptElementKind.moduleElement:
                    completionEntry.kind = 3 /* MODULE */;
                    break;
                case ts.ScriptElementKind.memberVariableElement:
                case ts.ScriptElementKind.variableElement:
                case ts.ScriptElementKind.localVariableElement:
                case ts.ScriptElementKind.parameterElement:
                    completionEntry.kind = 4 /* VARIABLE */;
                    break;
                case ts.ScriptElementKind.memberFunctionElement:
                case ts.ScriptElementKind.functionElement:
                case ts.ScriptElementKind.localFunctionElement:
                    completionEntry.kind = 6 /* FUNCTION */;
                    break;
                case ts.ScriptElementKind.typeParameterElement:
                case ts.ScriptElementKind.constructorImplementationElement:
                case ts.ScriptElementKind.constructSignatureElement:
                case ts.ScriptElementKind.callSignatureElement:
                case ts.ScriptElementKind.indexSignatureElement:
                case ts.ScriptElementKind.memberGetAccessorElement:
                case ts.ScriptElementKind.memberSetAccessorElement:
                    break;
            }
            //documentRegistry.releaseDocument(fileName, languageServiceHost.getCompilationSettings());
            return completionEntry;
        });
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
//TODO
///**
// * helper method return true if the token correspond to an 'completable' token
// */
//function isValidTokenKind(tokenKind: number) {
//    return tokenKind === TypeScript.SyntaxKind.IdentifierName ||
//        (tokenKind >= TypeScript.SyntaxKind.BreakKeyword && tokenKind < TypeScript.SyntaxKind.OpenBraceToken); 
//} 
