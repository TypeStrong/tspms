'use strict';

import promise = require('./promise');
import path = require('path');
import fs = require('./fileSystem');
import ws = require('./workingSet');
import ts = require('typescript');
import project = require('./project');
import utils = require('./utils');
import Logger  = require('./logger');
import CompilerManager = require('./compilerManager');

import ProjectFileKind = project.ProjectFileKind;
import TypeScriptProject = project.TypeScriptProject;
import createProject = project.createProject;
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;
import Map = utils.Map;

/**
 * @module ProjectManager
 * 
 * This module manage the different project of the services.
 * This is the main entry point for creating/updating/deleting/retrieving projects.
 */


//--------------------------------------------------------------------------
//
//  Type Definitions
//
//--------------------------------------------------------------------------

/**
 * ProjectManager configuration
 */
export type ProjectManagerConfig  = {
    /**
     * Absolute fileName of the `lib.d.ts` file associated to the bundled compiler.
     */
    defaultLibFileName: string;
    
    /**
     * The file system wrapper instance used by this module.
     */
    fileSystem: fs.IFileSystem;
    
    /**
     * Working set service.
     */
    workingSet: ws.IWorkingSet;
    
    /**
     * A Map project name to project configuration
     */
    projectConfigs: { [projectId: string]: TypeScriptProjectConfig; };
}

//--------------------------------------------------------------------------
//
//  Internal API
//
//--------------------------------------------------------------------------

/**
 * The file system wrapper instance used by this module.
 */
var fileSystem: fs.IFileSystem;

/**
 * The working set service.
 */
var workingSet: ws.IWorkingSet;

/**
 * A Map project name to ProjectInstance
 */
var projectMap: Map<TypeScriptProject> = Object.create(null);

/**
 * Temp Project used for typescript file that are not managed by any registred project.
 */
var tempProject: TypeScriptProject;

/**
 * Absolute filename of the directory opened in the editor.
 */
var currentDir: string;

/**
 * A promise queue used to insure async task are run sequentialy.
 */
var queue = utils.createPromiseQueue();

/**
 * Absolute fileName of the `lib.d.ts` file associated to the bundled compiler.
 */
var defaultLibFileName: string;

/**
 * A Map project name to project configuration
 */
var projectConfigs: Map<TypeScriptProjectConfig>;

/**
 * Create projects from project configs in the projectConfigs Map.
 */
function createProjects(): promise.Promise<any> {
    return promise.Promise.all(
        Object.keys(projectConfigs)
            .map(projectId => createProjectFromConfig(projectId, projectConfigs[projectId]))
    );
}

/**
 * Dispose every projects created by the ProjectManager module.
 */
function disposeProjects(): void {
    Object.keys(projectMap).forEach(path => {
        projectMap[path].dispose();
    });
    projectMap = Object.create(null);
    if (tempProject) {
        tempProject.dispose();
        tempProject = null;
    }
}

/**
 * For given config and project name create a project.
 * 
 * @param projectName the name of the project.
 * @param config the project config.
 */
function createProjectFromConfig(projectName: string, config: TypeScriptProjectConfig) {
    var project = createProject(currentDir, config, fileSystem, workingSet);
    return project.init().then(() => {
        projectMap[projectName] = project;
    }, () => {
        Logger.error('could not create project:' + projectName);
    });
}

/**
 * Returns a temporary project for the given filename.
 * This method will try to reuse the curent temp project if any and if it manage the given fileName.
 * 
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
function getTempProjectForFile(fileName: string): promise.Promise<TypeScriptProject> {
    //then we check if the current temp project has the file
    if (tempProject && tempProject.getProjectFilesSet()[fileName]) {
        return promise.Promise.resolve(tempProject);
    }
    
    if (tempProject) {
        tempProject.dispose();
        tempProject = null;
    }

      
    var config: TypeScriptProjectConfig = {
        sources: [fileName],
        compilerOptions: {
            target: ts.ScriptTarget.Latest,
            module: ts.ModuleKind.CommonJS,
            noLib: false
        }
    }

    tempProject = createProject(currentDir, config, fileSystem, workingSet);
    return tempProject.init().then(() => tempProject);
}

//--------------------------------------------------------------------------
//
//  Public API
//
//--------------------------------------------------------------------------

/**
 * Initialize the ProjectManager module.
 * 
 * @param config ProjectManager configuration
 */
export function init(config: ProjectManagerConfig): promise.Promise<void> {
    defaultLibFileName = config.defaultLibFileName;
    workingSet = config.workingSet;
    fileSystem = config.fileSystem;
    projectConfigs = config.projectConfigs;
    
    CompilerManager.init(config.fileSystem, config.defaultLibFileName);

    
    return queue.reset(fileSystem.getCurrentDir().then(dir => {
        currentDir = dir;
        return createProjects();
    }));
}


/**
 * Dispose the ProjectManager module.
 */
export function dispose(): void {
    queue.then(() => {
        disposeProjects();
        CompilerManager.dispose();
    });
}




/**
 * This function will try to find a project managing the given fileName. 
 * It will first try to retrieve a project that have that file matching the `sources` configuration of the project.
 * Then it will try to retrieve a project where one of the sources files has a reference over the given file.
 * Finally if no project has been found a temp project will be instanciated/reused.
 * 
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getProjectForFile(fileName: string): promise.Promise<TypeScriptProject> {
    return queue.then((): any => {
        var projects = utils.getMapValues(projectMap);
        var project: TypeScriptProject = null;
            
        //first we check for a project that have tha file as source 
        projects.some(tsProject => {
            if (tsProject.getProjectFileKind(fileName) === ProjectFileKind.SOURCE) {
                project = tsProject;
                return true;
            }
        });


        //then we check if a project has a file referencing the given file
        if (!project) {
            projects.some(tsProject => {
                if (tsProject.getProjectFileKind(fileName) === ProjectFileKind.REFERENCE) {
                    project = tsProject;
                    return true;
                }
            });
        }

        if (project) {
            return project;
        }

        return getTempProjectForFile(fileName);
    });
}


/**
 * This function will try to find all projects managing the given fileName. 
 * If no project has been found a temp project will be instanciated/reused.
 * 
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getAllProjectsForFile(fileName: string): promise.Promise<TypeScriptProject[]> {
    return queue.then((): any => {
        var projects = utils.getMapValues(projectMap);
            
        //first we check for a project that have tha file as source 
        projects = projects.filter(project => project.getProjectFileKind(fileName) !== ProjectFileKind.NONE);
        
        if (projects.length) {
            return projects;
        }

        return getTempProjectForFile(fileName).then(project => [project]);
    });
}


/**
 * Retrieve all projects managed by the project manager
 * 
 * @param fileName the absolute name of the typesrcript file for which projects are looked for.
 */
export function getAllProjects(): promise.Promise<TypeScriptProject[]> {
    return queue.then((): any => {
        var result = utils.getMapValues(projectMap);
        if (tempProject) {
            result.push(tempProject);
        }
        return result;
    });
}

/* 
 * Update / delete / create projects according to changes in project configs map.
 * 
 * @param configs the new Map of TypeScriptProjectConfig
 */
export function updateProjectConfigs(configs: Map<TypeScriptProjectConfig>): promise.Promise<void> {
    projectConfigs = configs;
    return queue.then(() => {
        var promises: promise.Promise<any>[] = [];
        Object.keys(projectMap).forEach(projectId => {
            var project = projectMap[projectId];
            var config = projectConfigs[projectId];
            
            if (!config) {
                project.dispose();
                delete projectMap[projectId];
            } else {
                promises.push(project.update(config));
            }
        });

        Object.keys(configs).forEach(projectId => {
            if (!projectMap[projectId]) {
                promises.push(createProjectFromConfig(projectId, projectConfigs[projectId]));
            }
        });
        
        return <any>promise.Promise.all(promises)
    });
};
