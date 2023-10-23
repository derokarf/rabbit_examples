test-nodejs_container=test-nodejs

.PHONY: help

## Application initialization
init: network-create install-packages
## Creates docker network if not exists
network-create:
	docker network create test-rabbitmq-network || true
## install project packages
install-packages:
	docker-compose -f docker-compose.test.yaml run ${test-nodejs_container} sh -c "npm install"
## run linter
lint:
	docker-compose -f docker-compose.test.yaml run ${test-nodejs_container} sh -c "npm run lint"
## run linter with fixing
lint-fix:
	docker-compose -f docker-compose.test.yaml run ${test-nodejs_container} sh -c "npm run lint-fix"
## tests
test-container:
	docker-compose -f docker-compose.test.yaml up -d
	sleep 5
	docker-compose -f docker-compose.test.yaml run ${test-nodejs_container} sh;
