'use strict';

import promise      = require('./promise');
import path = require('path');


import fs   = require('./fileSystem');
import ws = require('./workingSet');

import project = require('./project');
import ProjectFileKind = project.ProjectFileKind;
import TypeScriptProject = project.TypeScriptProject;
import createProject = project.createProject;
import TypeScriptProjectConfig = project.TypeScriptProjectConfig;

import utils = require('./utils');
import PromiseQueue = utils.PromiseQueue;
import console      = require('./logger');





export type ProjectManagerConfig  = {
    /**
     *  location of the default typescript compiler lib.d.ts file
     */
    defaultTypeScriptLocation: string;
    
    /**
     * editor filesystem manager
     */
    fileSystem: fs.IFileSystem;
    
    /**
     * ditor workingset manager 
     */
    workingSet: ws.IWorkingSet;
    
    /**
     * projects configurations
     */
    projectConfigs: { [projectId: string]: TypeScriptProjectConfig; };
}

//-------------------------------
//  variables
//-------------------------------


/**
 * editor filesystem manager
 */
var fileSystem: fs.IFileSystem;

/**
 * editor workingSet manager
 */
var workingSet: ws.IWorkingSet;


/**
 * a map containing the projects 
 */
var projectMap: { [key: string]: any /**Project*/} = {};

/**
 * tempory Project used for typescript file 
 * that correspond to no registred project
 */
var tempProject: TypeScriptProject;

/**
 * absolute path of the opened root directory 
 */
var projectRootDir: string;

/**
 * a promise queue used to insure async task are run sequentialy
 */
var queue = new PromiseQueue();

/**
 * location of the default typescript compiler lib.d.ts file
 */
var defaultTypeScriptLocation: string;


var projectConfigs: { [projectId: string]: TypeScriptProjectConfig; };



//-------------------------------
//  Private 
//------------------------------- 

/**
 * create projects from project configs retrieved by the preferenceManager
 */
function createProjects(): promise.Promise<any> {
    return promise.Promise.all(
        Object.keys(projectConfigs)
            .map(projectId => createProjectFromConfig(projectId, projectConfigs[projectId]))
    );
}

/**
 * dispose every projects created by the ProjectManager
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
 * for given config and projectId create a project
 * 
 * @param projectId the id of the project
 * @param config the project config
 */
function createProjectFromConfig(projectId: string, config: TypeScriptProjectConfig) {
    var project = createProject(
        projectRootDir,
        config,
        fileSystem,
        workingSet,
        path.join(defaultTypeScriptLocation, 'lib.d.ts')
    );
    return project.init().then(() => {
        projectMap[projectId] = project;
    }, () => {
        console.error('could not create project:' + projectId);
    });
}



//-------------------------------
// Public 
//------------------------------- 

/**
 * initialize the project manager
 * 
 * @param config ProjectManager configuration
 */
export function init(config: ProjectManagerConfig): promise.Promise<void> {

    defaultTypeScriptLocation = config.defaultTypeScriptLocation;
    workingSet = config.workingSet;
    fileSystem = config.fileSystem;
    projectConfigs = config.projectConfigs;


    return queue.init(fileSystem.getProjectRoot().then(rootDir => {
        projectRootDir = rootDir;
        return createProjects();
    }));
}


/**
 * dispose the project manager
 */
export function dispose(): void {
    queue.then(() => disposeProjects());
}

/**
 * this method will try to find a project referencing the given path
 * it will by priority try to retrive project that have that file as part of 'direct source'
 * before returning projects that just have 'reference' to this file
 * 
 * @param fileName the path of the typesrcript file for which project are looked fo
 */
export function getProjectForFile(fileName: string): promise.Promise<TypeScriptProject> {
    return queue.then((): any => {
        var projects = utils.mapValues(projectMap),
            project: TypeScriptProject = null;
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

        //then we check if the current temp project has the file
        if (!project) {
            if (tempProject && tempProject.getProjectFilesSet()[fileName]) {
                project = tempProject;
            } else if (tempProject) {
                tempProject.dispose();
                tempProject = null;
            }
        }

        //then if still no project found we create the temp project
        if (!project) {
            var config: TypeScriptProjectConfig = utils.clone(utils.typeScriptProjectConfigDefault);
            config.target = 'es5';
            config.module = 'commonjs';
            config.sources = [fileName];
            tempProject = project = createProject(
                projectRootDir,
                config,
                fileSystem,
                workingSet,
                path.join(defaultTypeScriptLocation, 'lib.d.ts')
            );
            return tempProject.init().then(() => tempProject);
        }

        return project;
    });
}


/* 
 * update / delete / create project according to changes in project configs
 */
export function updateProjectConfigs(configs: { [projectId: string]: TypeScriptProjectConfig; }): promise.Promise<void> {
    projectConfigs = configs;
    return queue.then(() => {
        var promises: promise.Promise<any>[] = [];
        Object.keys(projectMap).forEach(projectId => {
            var project = projectMap[projectId],
                config = projectConfigs[projectId];
            
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
        
        return <promise.Promise<void>><any>promise.Promise.all(promises)
    });
};









