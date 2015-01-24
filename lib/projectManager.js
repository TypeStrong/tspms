'use strict';
var promise = require('./promise');
var path = require('path');
var ts = require('typescript');
var project = require('./project');
var createProject = project.createProject;
var utils = require('./utils');
var PromiseQueue = utils.PromiseQueue;
var console = require('./logger');
//-------------------------------
//  variables
//-------------------------------
/**
 * editor filesystem manager
 */
var fileSystem;
/**
 * editor workingSet manager
 */
var workingSet;
/**
 * a map containing the projects
 */
var projectMap = {};
/**
 * tempory Project used for typescript file
 * that correspond to no registred project
 */
var tempProject;
/**
 * absolute path of the opened root directory
 */
var projectRootDir;
/**
 * a promise queue used to insure async task are run sequentialy
 */
var queue;
/**
 * location of the default typescript compiler lib.d.ts file
 */
var defaultTypeScriptLocation;
var projectConfigs;
var documentRegistry = ts.createDocumentRegistry();
//-------------------------------
//  Private 
//------------------------------- 
/**
 * create projects from project configs retrieved by the preferenceManager
 */
function createProjects() {
    return promise.Promise.all(Object.keys(projectConfigs).map(function (projectId) { return createProjectFromConfig(projectId, projectConfigs[projectId]); }));
}
/**
 * dispose every projects created by the ProjectManager
 */
function disposeProjects() {
    Object.keys(projectMap).forEach(function (path) {
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
function createProjectFromConfig(projectId, config) {
    var project = createProject(documentRegistry, projectRootDir, config, fileSystem, workingSet, path.join(defaultTypeScriptLocation, 'lib.d.ts'));
    return project.init().then(function () {
        projectMap[projectId] = project;
    }, function () {
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
function init(config) {
    defaultTypeScriptLocation = config.defaultTypeScriptLocation;
    workingSet = config.workingSet;
    fileSystem = config.fileSystem;
    projectConfigs = config.projectConfigs;
    queue = new PromiseQueue();
    return queue.init(fileSystem.getProjectRoot().then(function (rootDir) {
        projectRootDir = rootDir;
        return createProjects();
    }));
}
exports.init = init;
/**
 * dispose the project manager
 */
function dispose() {
    queue.then(function () { return disposeProjects(); });
}
exports.dispose = dispose;
/**
 * this method will try to find a project referencing the given path
 * it will by priority try to retrive project that have that file as part of 'direct source'
 * before returning projects that just have 'reference' to this file
 *
 * @param fileName the path of the typesrcript file for which project are looked fo
 */
function getProjectForFile(fileName) {
    return queue.then(function () {
        var projects = utils.mapValues(projectMap), project = null;
        //first we check for a project that have tha file as source 
        projects.some(function (tsProject) {
            if (tsProject.getProjectFileKind(fileName) === 1 /* SOURCE */) {
                project = tsProject;
                return true;
            }
        });
        //then we check if a project has a file referencing the given file
        if (!project) {
            projects.some(function (tsProject) {
                if (tsProject.getProjectFileKind(fileName) === 2 /* REFERENCE */) {
                    project = tsProject;
                    return true;
                }
            });
        }
        //then we check if the current temp project has the file
        if (!project) {
            if (tempProject && tempProject.getProjectFilesSet()[fileName]) {
                project = tempProject;
            }
            else if (tempProject) {
                tempProject.dispose();
                tempProject = null;
            }
        }
        //then if still no project found we create the temp project
        if (!project) {
            var config = utils.clone(utils.typeScriptProjectConfigDefault);
            config.target = 'es5';
            config.module = 'commonjs';
            config.sources = [fileName];
            tempProject = project = createProject(documentRegistry, projectRootDir, config, fileSystem, workingSet, path.join(defaultTypeScriptLocation, 'lib.d.ts'));
            return tempProject.init().then(function () { return tempProject; });
        }
        return project;
    });
}
exports.getProjectForFile = getProjectForFile;
/*
 * update / delete / create project according to changes in project configs
 */
function updateProjectConfigs(configs) {
    projectConfigs = configs;
    return queue.then(function () {
        var promises = [];
        Object.keys(projectMap).forEach(function (projectId) {
            var project = projectMap[projectId], config = projectConfigs[projectId];
            if (!config) {
                project.dispose();
                delete projectMap[projectId];
            }
            else {
                promises.push(project.update(config));
            }
        });
        Object.keys(configs).forEach(function (projectId) {
            if (!projectMap[projectId]) {
                promises.push(createProjectFromConfig(projectId, projectConfigs[projectId]));
            }
        });
        return promise.Promise.all(promises);
    });
}
exports.updateProjectConfigs = updateProjectConfigs;
;
