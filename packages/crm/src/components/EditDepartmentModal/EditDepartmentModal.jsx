import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { URLS } from '../../utilities/urls';
import { useNotification } from '../../contexts/NotificationProvider';
import { useLoader } from '../../contexts/LoaderProvider';
import Button from '../Button/Button';
import Input from '../Input/Input';
import Select from '../Select/Select';
import { FaPlus, FaTrash, FaSave, FaEdit } from 'react-icons/fa';
import classes from './EditDepartmentModal.module.css';

const EditDepartmentModal = ({ department, types, onClose, onSave }) => {
  const { notify } = useNotification();
  const { showLoader, hideLoader } = useLoader();

  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({
    name: department.name || '',
    description: department.description || '',
    ObjectId: department.ObjectId || '',
    workspaceId: department.workspaceId || '',
    active: department.active ?? true,
    defaultMaxLoad: department.defaultMaxLoad || 100,
    priorityMultiplier: department.priorityMultiplier || 1.0,
    loadCalculationFormula: department.loadCalculationFormula || 'taskCount * typeWeight * statusWeight * priorityMultiplier'
  });

  const [weights, setWeights] = useState([]);
  const [selectedType, setSelectedType] = useState('');
  const [typeWeight, setTypeWeight] = useState(1.0);
  const [statusInputs, setStatusInputs] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Состояния для редактирования
  const [editingTypeId, setEditingTypeId] = useState(null);
  const [editingTypeWeight, setEditingTypeWeight] = useState(1.0);
  const [editingStatusId, setEditingStatusId] = useState(null);
  const [editingStatusWeight, setEditingStatusWeight] = useState(1.0);

  useEffect(() => {
    fetchWeights();
  }, [department._id]);

  const fetchWeights = async () => {
    try {
      const { data } = await axios.get(
        URLS.GET_DEPARTMENT_WEIGHTS(department._id),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        const weightsData = data.data || [];
        setWeights(weightsData);

        const initialInputs = {};
        weightsData.forEach(typeWeight => {
          initialInputs[typeWeight.typeId] = {
            selectedStatus: '',
            statusWeight: 1.0
          };
        });
        setStatusInputs(initialInputs);
      }
    } catch (error) {
      console.error('Ошибка загрузки весов:', error);
      notify.error('Не удалось загрузить веса типов');
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSaveGeneral = async () => {
    if (!formData.name.trim()) {
      notify.error('Название обязательно');
      return;
    }

    showLoader();
    try {
      const { data } = await axios.put(
        URLS.UPDATE_DEPARTMENT(department._id),
        formData,
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Департамент обновлён');
        setHasChanges(false);
        onSave(data.data);
      }
    } catch (error) {
      console.error('Ошибка обновления:', error);
      notify.error(error.response?.data?.message || 'Не удалось обновить департамент');
    } finally {
      hideLoader();
    }
  };

  const handleAddType = async () => {
    if (!selectedType) {
      notify.error('Выберите тип задачи');
      return;
    }

    const type = types.find(t => t.typeId === selectedType);
    if (!type) return;

    showLoader();
    try {
      const { data } = await axios.put(
        URLS.SET_TYPE_WEIGHT(department._id, selectedType),
        {
          weight: typeWeight,
          typeName: type.name
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Тип добавлен');
        await fetchWeights();
        setSelectedType('');
        setTypeWeight(1.0);
      }
    } catch (error) {
      console.error('Ошибка добавления типа:', error);
      notify.error('Не удалось добавить тип');
    } finally {
      hideLoader();
    }
  };

  const handleRemoveType = async (typeId) => {
    if (!window.confirm('Удалить этот тип?')) return;

    showLoader();
    try {
      const { data } = await axios.delete(
        URLS.REMOVE_TYPE_WEIGHT(department._id, typeId),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Тип удалён');
        await fetchWeights();
      }
    } catch (error) {
      console.error('Ошибка удаления типа:', error);
      notify.error('Не удалось удалить тип');
    } finally {
      hideLoader();
    }
  };

  const handleStartEditType = (typeId, currentWeight) => {
    setEditingTypeId(typeId);
    setEditingTypeWeight(currentWeight);
  };

  const handleSaveTypeWeight = async (typeId) => {
    const type = types.find(t => t.typeId === typeId);
    if (!type) return;

    showLoader();
    try {
      const { data } = await axios.put(
        URLS.SET_TYPE_WEIGHT(department._id, typeId),
        {
          weight: editingTypeWeight,
          typeName: type.name
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Вес типа обновлён');
        await fetchWeights();
        setEditingTypeId(null);
      }
    } catch (error) {
      console.error('Ошибка обновления веса типа:', error);
      notify.error('Не удалось обновить вес типа');
    } finally {
      hideLoader();
    }
  };

  const handleAddStatus = async (typeId) => {
    const inputs = statusInputs[typeId];
    if (!inputs?.selectedStatus) {
      notify.error('Выберите статус');
      return;
    }

    const type = types.find(t => t.typeId === typeId);
    const status = type?.statuses?.find(s => s.id === inputs.selectedStatus);

    if (!status) return;

    showLoader();
    try {
      const { data } = await axios.put(
        URLS.SET_STATUS_WEIGHT(department._id, typeId, inputs.selectedStatus),
        {
          weight: inputs.statusWeight,
          statusName: status.name
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Статус добавлен');
        await fetchWeights();
        setStatusInputs(prev => ({
          ...prev,
          [typeId]: {
            selectedStatus: '',
            statusWeight: 1.0
          }
        }));
      }
    } catch (error) {
      console.error('Ошибка добавления статуса:', error);
      notify.error('Не удалось добавить статус');
    } finally {
      hideLoader();
    }
  };

  const handleRemoveStatus = async (typeId, statusId) => {
    if (!window.confirm('Удалить этот статус?')) return;

    showLoader();
    try {
      const { data } = await axios.delete(
        URLS.REMOVE_STATUS_WEIGHT(department._id, typeId, statusId),
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Статус удалён');
        await fetchWeights();
      }
    } catch (error) {
      console.error('Ошибка удаления статуса:', error);
      notify.error('Не удалось удалить статус');
    } finally {
      hideLoader();
    }
  };

  const handleStartEditStatus = (typeId, statusId, currentWeight) => {
    setEditingStatusId(`${typeId}-${statusId}`);
    setEditingStatusWeight(currentWeight);
  };

  const handleSaveStatusWeight = async (typeId, statusId) => {
    const type = types.find(t => t.typeId === typeId);
    const status = type?.statuses?.find(s => s.id === statusId);

    if (!status) return;

    showLoader();
    try {
      const { data } = await axios.put(
        URLS.SET_STATUS_WEIGHT(department._id, typeId, statusId),
        {
          weight: editingStatusWeight,
          statusName: status.name
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
          }
        }
      );

      if (data.success) {
        notify.success('Вес статуса обновлён');
        await fetchWeights();
        setEditingStatusId(null);
      }
    } catch (error) {
      console.error('Ошибка обновления веса статуса:', error);
      notify.error('Не удалось обновить вес статуса');
    } finally {
      hideLoader();
    }
  };

  const updateStatusInput = (typeId, field, value) => {
    setStatusInputs(prev => ({
      ...prev,
      [typeId]: {
        ...prev[typeId],
        [field]: value
      }
    }));
  };

  const availableTypes = types.filter(t => !weights.find(w => w.typeId === t.typeId));

  const getAvailableStatuses = (typeId) => {
    const type = types.find(t => t.typeId === typeId);
    const typeWeight = weights.find(w => w.typeId === typeId);

    if (!type || !typeWeight) return [];

    return type.statuses?.filter(s =>
      !typeWeight.statusWeights?.find(ws => ws.statusId === s.id)
    ) || [];
  };

  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2>Редактирование департамента</h2>
          <button className={classes.closeBtn} onClick={onClose}>×</button>
        </div>

        <div className={classes.tabs}>
          <button
            className={`${classes.tab} ${activeTab === 'general' ? classes.activeTab : ''}`}
            onClick={() => setActiveTab('general')}
          >
            Общие настройки
          </button>
          <button
            className={`${classes.tab} ${activeTab === 'weights' ? classes.activeTab : ''}`}
            onClick={() => setActiveTab('weights')}
          >
            Управление весами
          </button>
        </div>

        <div className={classes.content}>
          {activeTab === 'general' && (
            <div className={classes.generalSection}>
              <Input
                label="Название"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                required
              />

              <Input
                label="Описание"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                multiline
                rows={3}
              />

              <div className={classes.row}>
                <Input
                  label="Object ID"
                  value={formData.ObjectId}
                  onChange={(e) => handleInputChange('ObjectId', e.target.value)}
                  disabled
                />
                <Input
                  label="Workspace ID"
                  value={formData.workspaceId}
                  onChange={(e) => handleInputChange('workspaceId', e.target.value)}
                  disabled
                />
              </div>

              <div className={classes.row}>
                <Input
                  label="Макс. нагрузка"
                  type="number"
                  value={formData.defaultMaxLoad}
                  onChange={(e) => handleInputChange('defaultMaxLoad', Number(e.target.value))}
                  min={1}
                  max={1000}
                />
                <Input
                  label="Множитель приоритета"
                  type="number"
                  value={formData.priorityMultiplier}
                  onChange={(e) => handleInputChange('priorityMultiplier', Number(e.target.value))}
                  min={0.1}
                  max={10}
                  step={0.1}
                />
              </div>

              <Input
                label="Формула расчёта нагрузки"
                value={formData.loadCalculationFormula}
                onChange={(e) => handleInputChange('loadCalculationFormula', e.target.value)}
              />

              <label className={classes.checkbox}>
                <input
                  type="checkbox"
                  checked={formData.active}
                  onChange={(e) => handleInputChange('active', e.target.checked)}
                />
                <span>Активен</span>
              </label>

              <div className={classes.actions}>
                <Button onClick={handleSaveGeneral} disabled={!hasChanges}>
                  <FaSave /> Сохранить изменения
                </Button></div>
            </div>
          )}

          {activeTab === 'weights' && (
            <div className={classes.weightsSection}>
                {
                availableTypes.length > 0 && (
                    <div className={classes.addTypeSection}>
                <h3>Добавить тип задачи</h3>
                <div className={classes.addTypeForm}>
                  <Select
                    value={selectedType}
                    onChange={(e) => setSelectedType(e)}
                    options={[
                      { value: '', label: 'Выберите тип' },
                      ...availableTypes.map(t => ({
                        value: t.typeId,
                        label: t.name
                      }))
                    ]}
                  />
                  <Input
                    type="number"
                    value={typeWeight}
                    onChange={(e) => setTypeWeight(Number(e.target.value))}
                    min={0.1}
                    max={10}
                    step={0.1}
                    placeholder="Вес"
                  />
                  <Button onClick={handleAddType}>
                    <FaPlus /> Добавить
                  </Button>
                </div>
              </div>
                    )
                }


              <div className={classes.typesList}>
                {weights.map((typeWeight) => {
                  const type = types.find(t => t.typeId === typeWeight.typeId);
                  const availableStatuses = getAvailableStatuses(typeWeight.typeId);
                  const inputs = statusInputs[typeWeight.typeId] || { selectedStatus: '', statusWeight: 1.0 };
                  const isEditingType = editingTypeId === typeWeight.typeId;

                  return (
                    <div key={typeWeight.typeId} className={classes.typeCard}>
                      <div className={classes.typeHeader}>
                        <div className={classes.typeInfo}>
                          <h4>{type?.name || typeWeight.name}</h4>
                          {isEditingType ? (
                            <div className={classes.editWeightForm}>
                              <Input
                                type="number"
                                value={editingTypeWeight}
                                onChange={(e) => setEditingTypeWeight(Number(e.target.value))}
                                min={0.1}
                                max={10}
                                step={0.1}
                              />
                              <button
                                className={classes.saveWeightBtn}
                                onClick={() => handleSaveTypeWeight(typeWeight.typeId)}
                              >
                                <FaSave />
                              </button><button
                                className={classes.cancelWeightBtn}
                                onClick={() => setEditingTypeId(null)}
                              >×
                              </button>
                            </div>
                          ) : (
                            <div className={classes.weightDisplay}>
                              <span className={classes.weight}>Вес: {typeWeight.weight}</span>
                              <button
                                className={classes.editBtn}
                                onClick={() => handleStartEditType(typeWeight.typeId, typeWeight.weight)}
                                title="Изменить вес"
                              >
                                <FaEdit />
                              </button></div>
                          )}
                        </div>
                        <button
                          className={classes.removeBtn}
                          onClick={() => handleRemoveType(typeWeight.typeId)}
                          title="Удалить тип"
                        >
                          <FaTrash />
                        </button>
                      </div>

                      <div className={classes.statusesSection}>
                        <div className={classes.addStatusForm}>
                          <Select
                            value={inputs.selectedStatus}
                            onChange={(e) => updateStatusInput(typeWeight.typeId, 'selectedStatus', e)}
                            options={[
                              { value: '', label: 'Добавить статус' },
                              ...availableStatuses.map(s => ({
                                value: s.id,
                                label: s.name
                              }))
                            ]}
                          />
                          <Input
                            type="number"
                            value={inputs.statusWeight}
                            onChange={(e) => updateStatusInput(typeWeight.typeId, 'statusWeight', Number(e.target.value))}
                            min={0.1}
                            max={10}
                            step={0.1}placeholder="Вес"
                          />
                          <Button
                            onClick={() => handleAddStatus(typeWeight.typeId)}
                            size="small"
                          >
                            <FaPlus />
                          </Button>
                        </div>

                        {typeWeight.statusWeights && typeWeight.statusWeights.length > 0 && (
                          <div className={classes.statusesList}>
                            {typeWeight.statusWeights.map((status) => {
                              const editKey = `${typeWeight.typeId}-${status.statusId}`;
                              const isEditingStatus = editingStatusId === editKey;

                              return (
                                <div key={status.statusId} className={classes.statusItem}>
                                  <span className={classes.statusName}>{status.statusName}</span>

                                  {isEditingStatus ? (
                                    <div className={classes.editStatusWeightForm}>
                                      <Input
                                        type="number"
                                        value={editingStatusWeight}
                                        onChange={(e) => setEditingStatusWeight(Number(e.target.value))}
                                        min={0.1}
                                        max={10}
                                        step={0.1}
                                      />
                                      <button
                                        className={classes.saveWeightBtn}
                                        onClick={() => handleSaveStatusWeight(typeWeight.typeId, status.statusId)}
                                      >
                                        <FaSave />
                                      </button>
                                      <button
                                        className={classes.cancelWeightBtn}
                                        onClick={() => setEditingStatusId(null)}
                                      >
                                        ×
                                      </button>
                                    </div>
                                  ) : (
                                    <>
                                      <span className={classes.statusWeight}>Вес: {status.weight}</span>
                                      <button
                                        className={classes.editBtn}
                                        onClick={() => handleStartEditStatus(typeWeight.typeId, status.statusId, status.weight)}
                                        title="Изменить вес"
                                      >
                                        <FaEdit />
                                      </button><button
                                        className={classes.removeStatusBtn}
                                        onClick={() => handleRemoveStatus(typeWeight.typeId, status.statusId)}
                                        title="Удалить статус"
                                      >
                                        <FaTrash />
                                      </button>
                                    </>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {weights.length === 0 && (
                <div className={classes.emptyState}>
                  <p>Типы задач не добавлены</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default EditDepartmentModal;
