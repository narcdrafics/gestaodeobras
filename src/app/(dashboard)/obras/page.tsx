"use client";

import React, { useState } from "react";
import { Button, Card, Table, Tag, Typography, Progress, Space, Input, Popconfirm } from "antd";
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { ObraFormDrawer } from "@/components/obras/ObraFormDrawer";

const { Title, Text } = Typography;

export default function ObrasPage() {
  const { data, loading } = useTenantData();
  const { deleteItem } = useFirebaseMutations();
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  const [searchText, setSearchText] = useState("");

  const handleDelete = async (index: number) => {
    await deleteItem("obras", index);
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

  const mappedObras = data.obras.map((obra, idx) => ({ ...obra, originalIndex: idx, key: idx }));

  const filteredData = mappedObras.filter(o => 
     o?.nome?.toLowerCase().includes(searchText.toLowerCase()) || 
     o?.cod?.toLowerCase().includes(searchText.toLowerCase())
  );

  const columns = [
    {
      title: 'Obra / Cód',
      dataIndex: 'nome',
      key: 'nome',
      render: (text: string, record: any) => (
        <div>
          <b>{text}</b>
          <br />
          <Text type="secondary" style={{ fontSize: 12 }}>{record.cod}</Text>
        </div>
      )
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
         let color = "default";
         if (status === "Em andamento") color = "processing";
         if (status === "Concluída") color = "success";
         if (status === "Pausada") color = "warning";
         return <Tag color={color}>{status || "N/A"}</Tag>;
      }
    },
    {
      title: 'Orçamento',
      dataIndex: 'orc',
      key: 'orc',
      render: (val: number) => <b>{(Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</b>
    },
    {
      title: 'Mestre Responsável',
      dataIndex: 'mestre',
      key: 'mestre',
    },
    {
      title: 'Progresso Físico',
      key: 'perc',
      render: (_: any, record: any) => {
        // 1. Prioridade: Medições Físicas
        const meds = data.medicao.filter(m => m.obra === record.cod);
        if (meds.length > 0) {
           const avg = Math.round(meds.reduce((acc, m) => acc + Number(m.avanco || 0), 0) / meds.length);
           return <Progress percent={avg} size="small" status={avg >= 100 ? "success" : "active"} strokeColor="#52c41a" />;
        }
        
        // 2. Fallback: Tarefas Concluídas / Total
        const tasks = data.tarefas.filter(t => t?.obra === record.cod);
        const concluded = tasks.filter(t => t?.status === 'Concluída').length;
        const pct = tasks.length > 0 ? Math.round((concluded / tasks.length) * 100) : 0;
        return <Progress percent={pct} size="small" status={pct === 100 ? "success" : "active"} />;
      }
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space size="middle">
           <Button type="text" icon={<EditOutlined />} onClick={() => showDrawer(record, record.originalIndex)} style={{ color: '#1890ff' }}>Editar</Button>
           <Popconfirm title="Tem certeza que deseja apagar esta obra?" onConfirm={() => handleDelete(record.originalIndex)}>
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
          <Title level={2} style={{ margin: 0 }}>Gestão de Obras</Title>
          <Text type="secondary">Crie e acompanhe o portfólio completo dos seus projetos.</Text>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => showDrawer()} size="large" style={{ backgroundColor: '#1890ff' }}>
          Nova Obra
        </Button>
      </div>

      <Card variant="borderless" style={{ boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
        <div style={{ marginBottom: 16 }}>
           <Input 
             prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
             placeholder="Buscar obras por nome ou código..." 
             value={searchText}
             onChange={(e) => setSearchText(e.target.value)}
             style={{ maxWidth: 300 }}
             size="large"
           />
        </div>
        <Table 
          columns={columns} 
          dataSource={filteredData} 
          loading={loading}
          pagination={{ pageSize: 15 }}
          rowKey="key"
        />
      </Card>

      <ObraFormDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        record={editingRecord}
        recordIndex={editingIndex}
      />
    </div>
  );
}
