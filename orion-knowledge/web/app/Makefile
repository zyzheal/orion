PLATFORM=linux/amd64
TAG=main
REGISTRY=orion-knowledge-app


# 构建前端代码
build:
	pnpm run build

# 构建并加载到本地Docker
image: build
	docker buildx build \
	  -f Dockerfile \
	  --platform ${PLATFORM} \
	  --tag ${REGISTRY}/frontend:${TAG} \
	  --load \
	  .

save: image
	docker save -o /tmp/orion-knowledge-app_frontend.tar orion-knowledge-app/frontend:main
