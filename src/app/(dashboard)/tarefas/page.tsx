"use client";

import React, { useState, useEffect } from "react";
import { Button, Card, Table, Tag, Typography, Space, Input, Popconfirm, Segmented, Avatar } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined, AppstoreOutlined, UnorderedListOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { TarefaFormDrawer } from "@/components/tarefas/TarefaFormDrawer";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";

const { Title, Text } = Typography;

const KANBAN_COLUMNS = ["A fazer", "Em andamento", "Pausada", "Atrasada", "Concluída"];

export default function TarefasPage() {
  const { data, loading } = useTenantData();
  const { saveItem, deleteItem } = useFirebaseMutations();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<string>("Lista");
  
  // Hydration fix for DnD
  const [isBrowser, setIsBrowser] = useState(false);
  useEffect(() => { setIsBrowser(true); }, []);

  const handleDelete = async (index: number) => {
    await deleteItem("tarefas", index);
  };

  const showDrawer = (record?: any, index?: number) => {
    if (record && index !== undefined) {
      setEditingRecord(record);
      setEditingIndex(index);
    } else {
      setEditingRecord(null);
      setEditingIndex(undefined);
    }
    setDrawerVisible(true);
  };

  const mappedTarefas = data.tarefas.map((t, idx) => ({ ...t, originalIndex: idx, key: t?.cod || String(idx) }));

  const filteredData = mappedTarefas.filter(t => 
     t?.desc?.toLowerCase().includes(searchText.toLowerCase()) || 
     t?.cod?.toLowerCase().includes(searchText.toLowerCase()) ||
     t?.etapa?.toLowerCase().includes(searchText.toLowerCase())
  );

  const getStatusColor = (status: string) => {
      if (status === "Em andamento") return "processing";
      if (status === "Concluída") return "success";
      if (status === "Pausada") return "default";
      if (status === "Atrasada") return "error";
      return "warning";
  };

  const onDragEnd = (result: any) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) return;
    
    // Find item
    const movedItem = mappedTarefas.find(t => t.key === draggableId);
    if (movedItem) {
        // Change status based on destination drop ID
        const newStatus = destination.droppableId;
        const payload = { ...movedItem, status: newStatus };
        delete payload.originalIndex;
        delete payload.key;
        
        saveItem("tarefas", payload, movedItem.originalIndex);
    }
  };

  const columns = [
    {
      title: 'Cód / Descrição',
      dataIndex: 'desc',
      key: 'desc',
      render: (text: string, record: any) => (
        <div>
          <b>{text}</b><br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.cod}</Text>
        </div>
      )
    },
    {
      title: 'Obra',
      dataIndex: 'obra',
      key: 'obra',
      render: (val: string) => {
         const obraRef = data.obras.find(o => o?.cod === val);
         return <Tag color="blue">{obraRef?.nome || val}</Tag>;
      }
    },
    {
      title: 'Etapa',
      dataIndex: 'etapa',
      key: 'etapa',
      render: (val: string) => <Tag>{val || "Geral"}</Tag>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
         <Tag color={getStatusColor(status)}>{status || "N/A"}</Tag>
      )
    },
    {
      title: 'Prazo',
      dataIndex: 'prazo',
      key: 'prazo',
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
           <Button type="text" icon={<EditOutlined />} onClick={() => showDrawer(record, record.originalIndex)} style={{ color: '#1890ff' }}></Button>
           <Popconfirm title="Apagar tarefa?" onConfirm={() => handleDelete(record.originalIndex)}>
             <Button type="text" danger icon={<DeleteOutlined />}></Button>
           </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Cronograma Físico</Title>
          <Text type="secondary">Gerencie suas tarefas de ponta a ponta.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showDrawer()} size="large" style={{ backgroundColor: '#1890ff' }}>
          Nova Tarefa
        </Button>
      </div>

      <Card variant="borderless" style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
           <Input 
             prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
             placeholder="Buscar termo..." 
             value={searchText}
             onChange={(e) => setSearchText(e.target.value)}
             style={{ maxWidth: 300 }}
             size="large"
           />
           <Segmented 
             options={[
               { label: 'Lista', value: 'Lista', icon: <UnorderedListOutlined /> },
               { label: 'Quadro Kanban', value: 'Quadro', icon: <AppstoreOutlined /> },
             ]} 
             value={viewMode}
             onChange={setViewMode}
             size="large"
           />
        </div>
        
        {viewMode === "Lista" && (
            <Table 
              columns={columns} 
              dataSource={filteredData} 
              loading={loading}
              pagination={{ pageSize: 15 }}
            />
        )}
      </Card>

      {viewMode === "Quadro" && isBrowser && (
          <DragDropContext onDragEnd={onDragEnd}>
             <div style={{ display: 'flex', gap: 16, overflowX: 'auto', paddingBottom: 16 }}>
                {KANBAN_COLUMNS.map(col => {
                    const colTasks = filteredData.filter(t => (t.status || 'A fazer') === col);
                    
                    return (
                       <Droppable droppableId={col} key={col}>
                         {(provided, snapshot) => (
                           <div 
                              {...provided.droppableProps}
                              ref={provided.innerRef}
                              style={{ 
                                  background: snapshot.isDraggingOver ? '#e6f7ff' : '#f0f2f5', 
                                  minWidth: 300, 
                                  borderRadius: 8, 
                                  padding: 16,
                                  minHeight: 500
                              }}
                           >
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
                                 <Typography.Text strong>{col}</Typography.Text>
                                 <Tag style={{ borderRadius: 12 }}>{colTasks.length}</Tag>
                              </div>
                              
                              {colTasks.map((task, index) => (
                                 <Draggable key={task.key} draggableId={task.key} index={index}>
                                    {(provided, snapshot) => (
                                       <Card
                                          size="small"
                                          bordered={false}
                                          ref={provided.innerRef}
                                          {...provided.draggableProps}
                                          {...provided.dragHandleProps}
                                          style={{ 
                                             marginBottom: 12, 
                                             boxShadow: snapshot.isDragging ? '0 8px 16px rgba(0,0,0,0.1)' : '0 2px 4px rgba(0,0,0,0.05)',
                                             cursor: 'grab'
                                          }}
                                          actions={[
                                             <EditOutlined key="edit" onClick={() => showDrawer(task, task.originalIndex)} />
                                          ]}
                                       >
                                          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                             <Text type="secondary" style={{ fontSize: 11 }}>{task.cod}</Text>
                                             <Tag color={getStatusColor(col)} style={{ margin: 0 }}>{task.perc || 0}%</Tag>
                                          </div>
                                          <Text strong>{task.desc}</Text>
                                          <div style={{ marginTop: 8 }}>
                                             {task.photoUrl && (
                                                <div style={{ height: 60, overflow: 'hidden', borderRadius: 4, marginBottom: 8 }}>
                                                   <img src={task.photoUrl} alt="Evidência" style={{ width: '100%', objectFit: 'cover' }} />
                                                </div>
                                             )}
                                             <Text type="secondary" style={{ fontSize: 12 }}>Obra: {task.obra}</Text>
                                          </div>
                                       </Card>
                                    )}
                                 </Draggable>
                              ))}
                              {provided.placeholder}
                           </div>
                         )}
                       </Droppable>
                    )
                })}
             </div>
          </DragDropContext>
      )}

      <TarefaFormDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        record={editingRecord}
        recordIndex={editingIndex}
      />
    </div>
  );
}
