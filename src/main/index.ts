import ts = require('typescript');
import promise = require('./promise');
import ProjectManager = require('./projectManager');
import fs = require('./fileSystem');
import ws = require('./workingSet');
import project = require('./project');
import serviceUtils = require('./serviceUtils')

//--------------------------------------------------------------------------
//
//  Globally used definition
//
//--------------------------------------------------------------------------
export type Position = {
    line: number;
    ch: number;
}

//--------------------------------------------------------------------------
//
//  Promise Injection
//
//--------------------------------------------------------------------------

export function injectPromiseLibrary(lib: typeof promise.Promise) {
    promise.injectPromiseLibrary(lib);
}

//--------------------------------------------------------------------------
//
//  Project LifeCycle
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------

export import ProjectManagerConfig = ProjectManager.ProjectManagerConfig;

export import IFileSystem = fs.IFileSystem;
export import FileChangeRecord = fs.FileChangeRecord;
export import FileChangeKind = fs.FileChangeKind

export import IWorkingSet = ws.IWorkingSet;
export import DocumentChangeDescriptor = ws.DocumentChangeDescriptor;
export import DocumentChangeRecord = ws.DocumentChangeRecord;
export import WorkingSetChangeRecord = ws.WorkingSetChangeRecord;
export import WorkingSetChangeKind = ws.WorkingSetChangeKind;

export import TypeScriptProjectConfig = project.TypeScriptProjectConfig;

//--------------------------------------------------------------------------
//  init
//--------------------------------------------------------------------------

/**
 * Initializate the service
 * 
 * @param config the config used for the project managed
 */
export function init(config: ProjectManagerConfig): promise.Promise<void> {
    return ProjectManager.init(config);
}

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
export function updateProjectConfigs(configs: { [projectId: string]: TypeScriptProjectConfig; }): promise.Promise<void> {
    return ProjectManager.updateProjectConfigs(configs);
}

/**
 * dispose the service
 */
export function dispose(): void {
    ProjectManager.dispose();
}

//--------------------------------------------------------------------------
//
//  Definition Service
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------

/**
 * Represent definition info of a symbol
 */
export type DefinitionInfo = {
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

export function getDefinitionAtPosition(fileName: string, position: Position): promise.Promise<DefinitionInfo[]> {
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
                lineStart: startPos.line,
                charStart: startPos.ch,
                lineEnd: endPos.line,
                charEnd: endPos.ch,
                fileName: definition.fileName
            };
        });
    }).catch((): DefinitionInfo[]=> []);
}

//--------------------------------------------------------------------------
//
//  Error service
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  Definitions
//--------------------------------------------------------------------------

export const enum DiagnosticCategory {
    Warning,
    Error,
    Message
}

export type TSError = {
    pos: Position;
    endPos: Position;
    message: string;
    type: DiagnosticCategory;
}

//--------------------------------------------------------------------------
//  getErrorsForFile
//--------------------------------------------------------------------------

/**
 * Retrieve a list of errors for a given file
 * return a promise resolving to a list of errors
 * 
 * @param fileName the absolute path of the file 
 */
export function getErrorsForFile(fileName: string): promise.Promise<TSError[]> {
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

    }).catch((): TSError[]=> []);
}


//--------------------------------------------------------------------------
//
//  Formatting service
//
//--------------------------------------------------------------------------

//--------------------------------------------------------------------------
//  definitions
//--------------------------------------------------------------------------

export type TextEdit = {
    start: number;
    end: number;
    newText: string;
}

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
export function getFormatingForFile(fileName: string, options: ts.FormatCodeOptions, startPos?: Position, endPos?: Position): promise.Promise<TextEdit[]> {
    return ProjectManager.getProjectForFile(fileName).then(project => {

        var languageServiceHost = project.getLanguageServiceHost(),
            languageService = project.getLanguageService(),
            minChar: number, limChar: number;

        if (!startPos || !endPos) {
            minChar = 0;
            limChar = project.getLanguageServiceHost().getScriptContent(fileName).length - 1;
        } else {
            minChar = languageServiceHost.getIndexFromPosition(fileName, startPos);
            limChar = languageServiceHost.getIndexFromPosition(fileName, endPos);
        }
        var result = languageService.getFormattingEditsForRange(fileName, minChar, limChar, options).map(textChange  => ({
            start: textChange.span.start(),
            end: textChange.span.end(),
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

//--------------------------------------------------------------------------
//  definitions
//--------------------------------------------------------------------------

/**
 * Represent a completion result
 */
export type CompletionResult = {
    /**
     * the matched string portion
     */
    match: string;
    
    /**
     * list of proposed entries for code completion
     */
    entries: ts.CompletionEntryDetails[];
}



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
export function getCompletionAtPosition(fileName: string, position: Position, limit = 50, skip = 0): promise.Promise<CompletionResult> {
    return ProjectManager.getProjectForFile(fileName).then(project => {

        var languageService = project.getLanguageService(),
            languageServiceHost = project.getLanguageServiceHost(),
            index = languageServiceHost.getIndexFromPosition(fileName, position),
            completionInfo = languageService.getCompletionsAtPosition(fileName, index),
            typeScriptEntries = completionInfo && completionInfo.entries;


        if (!typeScriptEntries) {
            return { entries: [], match: '' };
        }

        var match: string;

        var sourceFile = languageService.getSourceFile(fileName);
        var typeScript = project.getTypeScriptInfo().typeScript;
        var word = serviceUtils.getTouchingWord(sourceFile, index, typeScript);


        if (word && serviceUtils.isWord(word.kind, typeScript)) {
            match = word.getText();
            typeScriptEntries = typeScriptEntries.filter(entry => {
                return entry.name && entry.name.toLowerCase().indexOf(match.toLowerCase()) === 0;
            });
        }



        var completionEntries = typeScriptEntries
            .sort((entry1, entry2) => {
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
            })
            .slice(skip, limit + skip)
            .map(typeScriptEntry => languageService.getCompletionEntryDetails(fileName, index, typeScriptEntry.name));

        return {
            entries: completionEntries,
            match: match
        };
    }).catch((): CompletionResult => ({
        entries: [],
        match: ''
    }));
}