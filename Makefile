SOURCES := src/**/*.js
DIST = $(SOURCES:src/%=dist/%)

all: $(DIST)

dist/%.js: src/%.js
	node_modules/.bin/babel $< > $@
