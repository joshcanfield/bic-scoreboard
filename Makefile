.PHONY: build test run clean install dist

GRADLE := ./gradlew

build:
	$(GRADLE) build

test:
	$(GRADLE) test

run:
	$(GRADLE) run

clean:
	$(GRADLE) clean

install:
	$(GRADLE) installDist

dist:
	$(GRADLE) distZip

