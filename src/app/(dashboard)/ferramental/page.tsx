"use client";

import React, { useState } from 'react';
import { 
  Table, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Row, 
  Col, 
  Statistic, 
  message, 
  Avatar, 
  Tooltip,
  Popconfirm
} from 'antd';
import { 
  ToolOutlined, 
  PlusOutlined, 
  EnvironmentOutlined, 
  UserOutlined, 
  IssuesCloseOutlined,
  HistoryOutlined,
  AuditOutlined
} from '@ant-design/icons';
import { useTenantData } from '@/hooks/useTenantData';
import { useFirebaseMutations } from '@/hooks/useFirebaseMutations';
import { FerramentalFormDrawer } from '@/components/ferramental/FerramentalFormDrawer';

const { Title, Text } = Typography;

export default function FerramentalPage() {
  const { data, loading } = useTenantData();
  const { deleteItem } = useFirebaseMutations();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);

  const ferramentalComp = data.ferramental.map((f, i) => ({ ...f, originalIndex: i }));

  const columns = [
    {
      title: 'Equipamento',
      key: 'nome',
      render: (r: any) => (
        <Space>
           <Avatar icon={<ToolOutlined />} style={{ backgroundColor: '#f0f0f0', color: '#1890ff' }} />
           <Space direction="vertical" size={0}>
              <Text strong>{r.nome}</Text>
              <Text type="secondary" style={{ fontSize: 11 }}>Nº Série: {r.serie || 'N/A'}</Text>
           </Space>
        </Space>
      )
    },
    {
      title: 'Localização (Obra)',
      dataIndex: 'obra',
      key: 'obra',
      render: (obraId: string) => {
        const obra = data.obras.find(o => o.cod === obraId);
        return <Tag icon={<EnvironmentOutlined />}>{obra?.nome || obraId || 'Central'}</Tag>;
      }
    },
    {
      title: 'Estado / Condição',
      dataIndex: 'condicao',
      key: 'condicao',
      render: (c: string) => {
        let color = "success";
        if (c === "Manutenção") color = "error";
        if (c === "Desgastado") color = "warning";
        return <Tag color={color}>{c || 'Bom'}</Tag>;
      }
    },
    {
      title: 'Responsável (Cautela)',
      dataIndex: 'resp',
      key: 'resp',
      render: (resp: string) => resp ? <Tag icon={<UserOutlined />} color="purple">{resp}</Tag> : <Text type="secondary">-</Text>
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        let color = "green";
        if (s === "Em Uso") color = "blue";
        if (s === "Manutenção") color = "red";
        if (s === "Extraviado") color = "black";
        return <Tag color={color}>{s || 'Disponível'}</Tag>;
      }
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
          <Button 
            size="small" 
            onClick={() => { setSelectedRecord(record); setIsDrawerOpen(true); }}
          >
            Editar
          </Button>
          <Popconfirm title="Remover este equipamento do inventário?" onConfirm={() => deleteItem("ferramental", record.originalIndex)}>
            <Button size="small" danger type="text">Remover</Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: 24 }}>
      <Row gutter={[16, 16]} justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
             <AuditOutlined style={{ marginRight: 8 }} />
             Gestão de Ferramental
          </Title>
          <Text type="secondary">Inventário de máquinas, equipamentos e ferramentas</Text>
        </Col>
        <Col>
           <Button 
             type="primary" 
             icon={<PlusOutlined />} 
             size="large"
             onClick={() => { setSelectedRecord(null); setIsDrawerOpen(true); }}
           >
             Novo Equipamento
           </Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Total Ativos" value={ferramentalComp.length} prefix={<ToolOutlined />} />
            </Card>
         </Col>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Em Manutenção" value={ferramentalComp.filter(f => f.status === "Manutenção").length} styles={{ content: { color: '#cf1322' } }} prefix={<IssuesCloseOutlined />} />
            </Card>
         </Col>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Em Uso (Obras)" value={ferramentalComp.filter(f => f.status === "Em Uso").length} prefix={<EnvironmentOutlined />} />
            </Card>
         </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12 }}>
         <Table 
           columns={columns} 
           dataSource={ferramentalComp} 
           loading={loading}
           rowKey="originalIndex"
         />
      </Card>

      <FerramentalFormDrawer
        visible={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        record={selectedRecord}
        recordIndex={selectedRecord?.originalIndex}
      />
    </div>
  );
}
