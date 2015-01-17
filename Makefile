CC=node node_modules/.bin/tsc
FLAGS=--module commonjs --noImplicitAny --target ES5

JEST=node node_modules/.bin/jest 

OUT_DIR=lib
MAIN=src/main
DECLARATION=src/declarations
__TESTS__=src/main/__tests__

DECLARATIONS=$(DECLARATION)/bluebird.d.ts $(DECLARATION)/core.d.ts $(DECLARATION)/minimatch.d.ts $(DECLARATION)/path.d.ts $(DECLARATION)/typescriptServices.d.ts 

SOURCES= $(MAIN)/fileSystem.ts $(MAIN)/index.ts $(MAIN)/languageServiceHost.ts $(MAIN)/logger.ts $(MAIN)/project.ts $(MAIN)/projectManager.ts $(MAIN)/utils.ts $(MAIN)/workingSet.ts

TESTS=$(DECLARATION)/jest.d.ts  $(__TESTS__)/fileSystemMock.ts $(__TESTS__)/workingSetMock.ts $(__TESTS__)/project-tests.ts $(__TESTS__)/languageServiceHost-test.ts $(__TESTS__)/projectManager-test.ts

all: test clean build 
	
build: $(DECLARATIONS) $(SOURCES) 
	$(CC) $(FLAGS) $^ --outDir $(OUT_DIR)
    
build-test: $(DECLARATIONS) $(SOURCES) $(TESTS)
	$(CC) $(FLAGS) $^ --outDir $(OUT_DIR)
    

test: build-test
	$(JEST)

clean: 
	rm -rf lib

