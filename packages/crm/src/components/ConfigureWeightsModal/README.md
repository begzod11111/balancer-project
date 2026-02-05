# ConfigureWeightsModal - Компонент настройки весов задач департамента

## Описание

Модальное окно для настройки весов типов задач и их статусов для конкретного департамента. Позволяет управлять приоритетами распределения задач на основе их типа и статуса.

## Использование

```jsx
import React, { useState } from 'react';
import ConfigureWeightsModal from './components/ConfigureWeightsModal/ConfigureWeightsModal';

const YourComponent = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [department, setDepartment] = useState(null);
  const [types, setTypes] = useState([]);

  // Загрузка департамента
  useEffect(() => {
    fetchDepartment();
    fetchTypes();
  }, []);

  const fetchDepartment = async () => {
    const response = await axios.get(`/api/department/${departmentId}`);
    setDepartment(response.data.data);
  };

  const fetchTypes = async () => {
    const response = await axios.get('/api/analytics/type', {
      params: { active: true }
    });
    setTypes(response.data.data);
  };

  const handleUpdate = () => {
    // Обновление данных после сохранения
    fetchDepartment();
    setIsModalOpen(false);
  };

  return (
    <>
      <button onClick={() => setIsModalOpen(true)}>
        Настроить веса
      </button>

      {isModalOpen && (
        <ConfigureWeightsModal
          department={department}
          types={types}
          onClose={() => setIsModalOpen(false)}
          onUpdate={handleUpdate}
        />
      )}
    </>
  );
};
```

## Props

### department (обязательный)
Объект департамента со следующей структурой:
```javascript
{
  "_id": "6960db2a3c1fb65290e7fd8d",
  "name": "Customer Complaints",
  "active": true,
  "taskTypeWeights": [
    {
      "typeId": "10152",
      "name": "[System] Incident",
      "weight": 1,
      "statusWeights": [
        {
          "statusId": "10228",
          "statusName": "CANCELED",
          "weight": 4
        }
      ]
    }
  ]
}
```

### types (обязательный)
Массив типов задач со следующей структурой:
```javascript
[
  {
    "_id": "69626150d53b0f372a72d5b8",
    "typeId": "10152",
    "name": "[System] Incident",
    "category": "task",
    "defaultWeight": 1,
    "active": true,
    "weightedStatuses": [
      {
        "statusId": "10228",
        "name": "CANCELED",
        "weight": 1
      },
      {
        "statusId": "10229",
        "name": "In Progress",
        "weight": 1
      }
    ]
  }
]
```

### onClose (обязательный)
Функция обратного вызова для закрытия модального окна.

### onUpdate (опциональный)
Функция обратного вызова, вызываемая после успешного сохранения изменений.

## Возможности

### 1. Управление весами типов задач
- Добавление веса для типа задачи (0.1 - 10.0)
- Изменение веса типа задачи
- Удаление веса типа (возврат к значению по умолчанию)

### 2. Управление весами статусов
- Раскрытие списка статусов для типа задачи
- Добавление веса для конкретного статуса
- Изменение веса статуса
- Удаление веса статуса (использование веса типа)

### 3. Поиск
- Поиск типов задач по названию или ID
- Фильтрация в реальном времени

### 4. Валидация
- Проверка диапазона весов (0.1 - 10.0)
- Уведомления об ошибках

## API Endpoints

Компонент использует следующие API endpoints:

### SET_TYPE_WEIGHT
```
PUT /api/shift-service/department/:departmentId/weights/:typeId

Body:
{
  "typeId": "10152",
  "name": "[System] Incident",
  "weight": 1.0,
  "statusWeights": [
    {
      "statusId": "10228",
      "statusName": "CANCELED",
      "weight": 4.0
    }
  ]
}

Headers:
{
  "Authorization": "Bearer <accessToken>"
}
```

## Стили

Компонент использует CSS-модули с темной/светлой темой:

- `--bg-primary` - основной фон
- `--bg-secondary` - вторичный фон
- `--bg-tertiary` - третичный фон
- `--text-primary` - основной текст
- `--text-secondary` - вторичный текст
- `--text-tertiary` - третичный текст
- `--accent-color` - акцентный цвет
- `--border-color` - цвет границ

## Зависимости

- React 16.8+
- axios
- react-icons/fa
- Кастомные компоненты:
  - Button
  - Input
- Контексты:
  - NotificationProvider
  - LoaderProvider

## Примечания

1. **Веса статусов** переопределяют веса типов для конкретных статусов задач
2. Если вес статуса не задан, используется вес типа
3. Если вес типа не задан, используется значение по умолчанию (1.0)
4. Все изменения сохраняются только после нажатия кнопки "Сохранить изменения"
5. Компонент автоматически использует loader и уведомления из контекстов

## Пример полной интеграции в DepartmentsPage

```jsx
import ConfigureWeightsModal from './components/ConfigureWeightsModal/ConfigureWeightsModal';

const DepartmentsPage = () => {
  const [configuringDepartment, setConfiguringDepartment] = useState(null);
  const [types, setTypes] = useState([]);

  useEffect(() => {
    fetchTypes();
  }, []);

  const fetchTypes = async () => {
    const response = await axios.get(URLS.GET_ALL_TYPES, {
      params: { active: true },
      headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` }
    });
    setTypes(response.data.data);
  };

  return (
    <div>
      {/* Department cards with configure button */}
      <button onClick={() => setConfiguringDepartment(department)}>
        <FaCog /> Настроить
      </button>

      {/* Configure Weights Modal */}
      {configuringDepartment && (
        <ConfigureWeightsModal
          department={configuringDepartment}
          types={types}
          onClose={() => setConfiguringDepartment(null)}
          onUpdate={() => {
            fetchDepartments();
            setConfiguringDepartment(null);
          }}
        />
      )}
    </div>
  );
};
```
