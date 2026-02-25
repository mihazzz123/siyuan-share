#!/bin/bash

# Сценарий автоматического развертывания SiYuan Share на сервере
# Этот скрипт собирает фронтенд, бэкенд и перезапускает службу systemd.

# Цвета для вывода
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Определение путей
PROJECT_ROOT="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
FRONTEND_DIR="$PROJECT_ROOT/backend/web"
BACKEND_DIR="$PROJECT_ROOT/backend/api"
SERVICE_NAME="siyuan-share"

echo -e "${BLUE}>>> Начало процесса развертывания...${NC}"

# 1. Сборка фронтенда
echo -e "${BLUE}>>> Сборка фронтенда (React)...${NC}"
cd "$FRONTEND_DIR" || exit
if [ ! -d "node_modules" ]; then
    echo -e "${BLUE}>>> Установка зависимостей npm...${NC}"
    npm install
fi

echo -e "${BLUE}>>> Запуск npm run build...${NC}"
npm run build
if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при сборке фронтенда!${NC}"
    exit 1
fi

# 2. Подготовка бэкенда
echo -e "${BLUE}>>> Копирование дистрибутива фронтенда в бэкенд...${NC}"
rm -rf "$BACKEND_DIR/dist"
cp -r "$FRONTEND_DIR/dist" "$BACKEND_DIR/"

# 3. Сборка бэкенда
echo -e "${BLUE}>>> Сборка бэкенда (Go)...${NC}"
cd "$BACKEND_DIR" || exit
go build -o siyuan-share-api
if [ $? -ne 0 ]; then
    echo -e "${RED}Ошибка при сборке бэкенда!${NC}"
    exit 1
fi

# 4. Перезапуск службы
echo -e "${BLUE}>>> Перезапуск службы $SERVICE_NAME...${NC}"
if systemctl is-active --quiet "$SERVICE_NAME"; then
    sudo systemctl restart "$SERVICE_NAME"
    echo -e "${GREEN}Служба успешно перезапущена.${NC}"
else
    echo -e "${RED}Служба $SERVICE_NAME не активна или не установлена.${NC}"
    echo -e "Вы можете запустить её вручную: ${NC}cd $BACKEND_DIR && ./siyuan-share-api"
fi

echo -e "${GREEN}>>> Развертывание завершено успешно!${NC}"
echo -e "${BLUE}URL сервера: https://share.your-domain.com${NC}"
