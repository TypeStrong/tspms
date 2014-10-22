
import Promise          = require('bluebird');
import ProjectManager   = require('./projectManager');
import fs               = require('./fileSystem');
import ws               = require('./workingSet');
import project          = require('./project');

export interface Position { 
    line: number; 
    ch: number; 
}



export function init(config: ProjectManager.ProjectManagerConfig) {
    return ProjectManager.init(config);
}



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

export function getDefinitionForFile(fileName: string, position: Position ): Promise<DefinitionInfo[]> {
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
    }).catch(() => []);
}