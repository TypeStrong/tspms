
import Promise          = require('bluebird');
import ts               = require('typescript');
import ProjectManager   = require('./projectManager');
import fs               = require('./fileSystem');
import ws               = require('./workingSet');
import project          = require('./project');
import serviceUtils     = require('./serviceUtils')

export interface Position { 
    line: number; 
    ch: number; 
}

//--------------------------------------------------------------------------
//
//  Initialization
//
//--------------------------------------------------------------------------

export function init(config: ProjectManager.ProjectManagerConfig): Promise<void> {
    return ProjectManager.init(config);
}


export function dispose(): void {
    ProjectManager.dispose();
}

//--------------------------------------------------------------------------
//
//  Definition Service
//
//--------------------------------------------------------------------------


/**
 * Represent definition info of a symbol
 */
export interface DefinitionInfo {
    /**
     * full name of the symbol
     */
    name: string;
    
    /**
     * line at which the symbol definition start
     */
    lineStart: number;
    
    /**
     * charachter at which the symbol definition start
     */
    charStart: number;
    
    /**
     * line at which the symbol definition end
     */
    lineEnd: number;
    
    /**
     * charachter at which the symbol definition end
     */
    charEnd: number;
    
    /**
     * path of the file where the symbol is defined
     */
    fileName: string;
}



/**
 * retrieve definition info of a symbol at a given position in a given file
 * @param fileName the absolute path of the file 
 * @param position in the file where you want to retrieve definition info
 * 
 * @return a promise resolving to a list of definition info
 */

export function getDefinitionAtPosition(fileName: string, position: Position ): Promise<DefinitionInfo[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService(),
            languageServiceHost = project.getLanguageServiceHost(),
            index = languageServiceHost.getIndexFromPosition(fileName, position);
        
        if (index < 0) {
            return [];
        }
        
        return languageService.getDefinitionAtPosition(fileName, index).map(definition => {
            var startPos = languageServiceHost.getPositionFromIndex(definition.fileName, definition.textSpan.start()),
                endPos = languageServiceHost.getPositionFromIndex(definition.fileName, definition.textSpan.end());
            return {
                name: (definition.containerName ? (definition.containerName + '.') : '') + definition.name,
                lineStart : startPos.line,
                charStart : startPos.ch,
                lineEnd : endPos.line,
                charEnd : endPos.ch,
                fileName: definition.fileName
            };
        });
    }).catch((): DefinitionInfo[]  => []);
}

//--------------------------------------------------------------------------
//
//  Error service
//
//--------------------------------------------------------------------------

export enum DiagnosticCategory {
    Warning = 0,
    Error = 1,
    Message = 2
}

export interface TSError {
    pos: Position;
    endPos: Position;
    message: string;
    type: DiagnosticCategory;
}


/**
 * Retrieve a list of errors for a given file
 * @param fileName the absolute path of the file 
 * 
 * @return a promise resolving to a list of errors
 */
export function getErrorsForFile(fileName: string): Promise<TSError[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {
        var languageService = project.getLanguageService(),
            languageServiceHost = project.getLanguageServiceHost(),
            diagnostics = languageService.getSyntacticDiagnostics(fileName);

        if (diagnostics.length === 0) {
            diagnostics = languageService.getSemanticDiagnostics(fileName);
        }

        return diagnostics.map(diagnostic => ({
            pos: languageServiceHost.getPositionFromIndex(fileName, diagnostic.start),
            endPos: languageServiceHost.getPositionFromIndex(fileName, diagnostic.length + diagnostic.start),
            message: diagnostic.messageText, 
            type: diagnostic.category
        }));
        
    }).catch((): TSError[] => []);
}


//--------------------------------------------------------------------------
//
//  Formatting service
//
//--------------------------------------------------------------------------


export interface TextEdit {
    pos: Position;
    endPos: Position;
    newText: string;
}

/**
 * Retrieve formating information for a givent file
 * @param fileName the absolute path of the file 
 * @param options formation options
 * @param startPos an option start position for the formating range
 * @param endPos an optional end position for the formating range
 * 
 * @return a promise resolving to a formating range info
 */
export function getFormatingForFile(fileName: string, options: ts.FormatCodeOptions, startPos?: Position, endPos?: Position): Promise<TextEdit[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {

        var languageServiceHost = project.getLanguageServiceHost(),
            languageService = project.getLanguageService(),
            minChar: number, limChar: number;

        if (!startPos || ! endPos) {
            minChar = 0;
            limChar = project.getLanguageServiceHost().getScriptContent(fileName).length - 1;
        } else {
            minChar = languageServiceHost.getIndexFromPosition(fileName, startPos);
            limChar = languageServiceHost.getIndexFromPosition(fileName, endPos);
        }

        var result = languageService.getFormattingEditsForRange(fileName, minChar, limChar, options).map(textChange  => ({
            pos: languageServiceHost.getPositionFromIndex(fileName, textChange.span.start()),
            endPos: languageServiceHost.getPositionFromIndex(fileName, textChange.span.end() - textChange.span.start()),
            newText: textChange.newText
        }));

        return result && result.reverse();
    });
}





//--------------------------------------------------------------------------
//
//  Completion service
//
//--------------------------------------------------------------------------

/**
 * An Enum representing the different kind of hint
 */
export enum CompletionKind {
    /**
     * the completion entry correspond to a class name
     */
    CLASS,
    /**
     * the completion entry correspond to an interface name
     */
    INTERFACE,
    /**
     * the completion entry correspond to an enum name
     */
    ENUM,
    /**
     * the completion entry correspond to a module name
     */
    MODULE,
    /**
     * the completion entry correspond to a variable name
     */
    VARIABLE,
    /**
     * the completion entry correspond to a mehtod name
     */
    METHOD,
    /**
     * the completion entry correspond to a function
     */
    FUNCTION,
    /**
     * the completion entry correspond to a keyword
     */
    KEYWORD,
    /**
     * Any other type
     */
    DEFAULT
}

/**
 * Represent an entry in a completion proposal list
 */
export interface CompletionEntry {
    /**
     * the name of the entry (aka: the text to insert)
     */
    name: string;
    
    /**
     * type of the symbol of the entry
     */
    type: string;
    
    /**
     * the entry kind
     */
    kind: CompletionKind;
    
    /**
     * JSDoc contents corresponding to this entry
     */
    doc: string;
}

/**
 * Represent a completion result
 */
export interface CompletionResult {
    /**
     * the matched string portion
     */
    match: string;
    
    /**
     * list of proposed entries for code completion
     */
    entries: CompletionEntry[];
}




/**
 * Retrieve completion proposal at a given point in a given file
 * @param fileName the absolute path of the file 
 * @param position in the file where you want to retrieve completion proposal
 * 
 * @return a promise resolving to a list of proposals
 */
export function getCompletionAtPosition(fileName: string, position: Position): Promise<CompletionResult> {
    return ProjectManager.getProjectForFile(fileName).then(project => {

        var languageService = project.getLanguageService(),
            languageServiceHost = project.getLanguageServiceHost(),
            index = languageServiceHost.getIndexFromPosition(fileName, position),
            completionInfo = languageService.getCompletionsAtPosition(fileName, index),
            typeScriptEntries = completionInfo && completionInfo.entries;


        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }

        var  match: string;
        
        var sourceFile = languageService.getSourceFile(fileName);
        var typeScript = project.getTypeScriptInfo().typeScript;
        var word = serviceUtils.getTouchingWord(sourceFile, index, typeScript);
        
        
        if (word && serviceUtils.isWord(word.kind, typeScript)) {
            match = word.getText();
            typeScriptEntries = typeScriptEntries.filter(entry => {
                return entry.name && entry.name.toLowerCase().indexOf(match.toLowerCase()) === 0;
            });
        }


        typeScriptEntries.sort((entry1, entry2) => {
            var match1 = entry1 ? entry1.name.indexOf(match) : -1,
                match2 = entry2 ? entry2.name.indexOf(match) : -1;
            if (match1 === 0 && match2 !== 0) {
                return -1;
            } else if (match2 === 0 && match1 !== 0) {
                return 1;
            } else {
                var name1 = entry1 && entry1.name.toLowerCase(),
                    name2 = entry2 && entry2.name.toLowerCase();

                if (name1 < name2) {
                    return -1;
                } else if (name1 > name2) {
                    return 1;
                } else {
                    return 0;
                }
            }
        });

        var completionEntries = typeScriptEntries.map(typeScriptEntry => {
            var entryInfo = languageService.getCompletionEntryDetails(fileName, index, typeScriptEntry.name),
                //TODO
                completionEntry = {
                    name: typeScriptEntry.name,
                    kind: CompletionKind.DEFAULT,
                    type: entryInfo && '', //&& entryInfo.type,
                    doc: entryInfo && '' //&& entryInfo.docComment
                };


            ///check with this https://github.com/Microsoft/TypeScript/blob/a1e69b0dc2ec43a3b40b77f871d9c676c253ce09/src/services/services.ts#L1171
            switch (typeScriptEntry.kind) {
                case ts.ScriptElementKind.unknown:
                case ts.ScriptElementKind.primitiveType:
                case ts.ScriptElementKind.scriptElement:
                    break;
                case ts.ScriptElementKind.keyword:
                    completionEntry.kind = CompletionKind.KEYWORD;
                    break;

                case ts.ScriptElementKind.classElement:
                    completionEntry.kind = CompletionKind.CLASS;
                    break;
                case ts.ScriptElementKind.interfaceElement:
                    completionEntry.kind = CompletionKind.INTERFACE;
                    break;
                case ts.ScriptElementKind.enumElement:
                    completionEntry.kind = CompletionKind.ENUM;
                    break;
                case ts.ScriptElementKind.moduleElement:
                    completionEntry.kind = CompletionKind.MODULE;
                    break;


                case ts.ScriptElementKind.memberVariableElement:
                case ts.ScriptElementKind.variableElement:
                case ts.ScriptElementKind.localVariableElement:
                case ts.ScriptElementKind.parameterElement:
                    completionEntry.kind = CompletionKind.VARIABLE;
                    break;


                case ts.ScriptElementKind.memberFunctionElement:
                case ts.ScriptElementKind.functionElement:
                case ts.ScriptElementKind.localFunctionElement:
                    completionEntry.kind = CompletionKind.FUNCTION;
                    break;


                case ts.ScriptElementKind.typeParameterElement:
                case ts.ScriptElementKind.constructorImplementationElement:
                case ts.ScriptElementKind.constructSignatureElement:
                case ts.ScriptElementKind.callSignatureElement:
                case ts.ScriptElementKind.indexSignatureElement:
                case ts.ScriptElementKind.memberGetAccessorElement:
                case ts.ScriptElementKind.memberSetAccessorElement:
                    //TODO
//                    if (logger.information()) {
//                        logger.log('un handled ScriptElementKind in completion list: ' +  typeScriptEntry.kind);
//                    }
                    break;
            }
            
            //documentRegistry.releaseDocument(fileName, languageServiceHost.getCompilationSettings());

            return completionEntry;
        });

        return {
            entries: completionEntries,
            match : match
        };
    }).catch((): CompletionResult => ({
        entries: [],
        match : ''
    }));
}

//TODO
///**
// * helper method return true if the token correspond to an 'completable' token
// */
//function isValidTokenKind(tokenKind: number) {
//    return tokenKind === TypeScript.SyntaxKind.IdentifierName ||
//        (tokenKind >= TypeScript.SyntaxKind.BreakKeyword && tokenKind < TypeScript.SyntaxKind.OpenBraceToken); 
//}