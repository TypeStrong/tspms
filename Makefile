CC=node node_modules/.bin/tsc
FLAGS=--module commonjs --noImplicitAny --target ES5

JEST=node node_modules/.bin/jest 

OUT_DIR=built
MAIN=src/main
DECLARATION=src/declarations
__TESTS__=src/main/__tests__

DECLARATIONS=$(DECLARATION)/bluebird.d.ts $(DECLARATION)/core.d.ts $(DECLARATION)/minimatch.d.ts $(DECLARATION)/path.d.ts $(DECLARATION)/typescript.d.ts 

SOURCES= $(MAIN)/fileSystem.ts $(MAIN)/index.ts $(MAIN)/languageServiceHost.ts  $(MAIN)/project.ts $(MAIN)/projectManager.ts $(MAIN)/utils.ts $(MAIN)/workingSet.ts $(MAIN)/serviceUtils.ts

TESTS=$(DECLARATION)/jest.d.ts  $(__TESTS__)/fileSystemMock.ts $(__TESTS__)/workingSetMock.ts $(__TESTS__)/project-tests.ts $(__TESTS__)/languageServiceHost-test.ts $(__TESTS__)/projectManager-test.ts

GENERATED_DECLARATION=$(OUT_DIR)/fileSystem.d.ts  $(OUT_DIR)/languageServiceHost.d.ts  $(OUT_DIR)/project.d.ts $(OUT_DIR)/projectManager.d.ts $(OUT_DIR)/utils.d.ts $(OUT_DIR)/workingSet.d.ts $(OUT_DIR)/serviceUtils.d.ts

all: test clean build 

generate_delcaration: $(GENERATED_DECLARATION)
	node ./scripts/concat-declaration --moduleName typescript-project-services --mainFile $(OUT_DIR)/index.d.ts $^ | sed 's/typescript-project-services\/built/typescript-project-services\/lib/g' > index.d.ts 
	
build: $(DECLARATIONS) $(SOURCES) 
	$(CC) $(FLAGS) -d $^ --outDir $(OUT_DIR)
    
build-test: $(DECLARATIONS) $(SOURCES) $(TESTS)
	$(CC) $(FLAGS) $^ --outDir $(OUT_DIR)

test: build-test
	$(JEST)

clean: 
	rm -rf lib

