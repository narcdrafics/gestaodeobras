"use client";

import React, { useState } from "react";
import { Button, Card, Table, Tag, Typography, Tabs, Space, Statistic, Row, Col, Popconfirm, Image } from "antd";
import { PlusOutlined, DeleteOutlined, InfoCircleOutlined, EditOutlined, FileSearchOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { MedicaoFormDrawer } from "@/components/medicoes/MedicaoFormDrawer";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function MedicoesPage() {
  const { data, loading } = useTenantData();
  const { deleteItem } = useFirebaseMutations();
  
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState<any>(null);
  const [editingIndex, setEditingIndex] = useState<number | undefined>(undefined);
  
  const formatBRL = (val: number) => (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const showDrawer = (record?: any, index?: number) => {
    setEditingRecord(record || null);
    setEditingIndex(index);
    setDrawerVisible(true);
  };

  const columnsMedicao = [
    { title: 'Data/Semana', dataIndex: 'semana', key: 'semana', render: (val: string) => <Tag>{val?.split('-').reverse().join('/')}</Tag> },
    { title: 'Serviço', dataIndex: 'servico', key: 'servico', render: (text: string, r: any) => <b>{text} <br/> <Text type="secondary" style={{fontSize: 11}}>{r.etapa} - {r.frente}</Text></b> },
    { title: 'Equipe', dataIndex: 'equipe', key: 'equipe' },
    { title: 'Avanço', dataIndex: 'avanco', key: 'avanco', render: (val: number) => <Tag color="blue">{val}%</Tag> },
    { title: 'Valor Total', dataIndex: 'vtotal', key: 'vtotal', render: (val: number) => <Text strong>{formatBRL(val)}</Text> },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
         const colors: any = { 'Pago': 'success', 'Parcial': 'warning', 'Pendente': 'default', 'Atrasado': 'error' };
         return <Tag color={colors[val] || 'default'}>{val}</Tag>;
    }},
    { title: 'Evidência', dataIndex: 'fotoUrl', key: 'foto', render: (val: string) => val ? <Image src={val} width={40} style={{ borderRadius: 4 }} /> : '-' },
    { title: 'Ações', key: 'actions', render: (_: any, record: any) => (
        <Space>
           <Button type="text" icon={<EditOutlined />} onClick={() => showDrawer(record, record.originalIndex)} />
           <Popconfirm title="Apagar?" onConfirm={() => deleteItem("medicao", record.originalIndex)}>
             <Button type="text" danger icon={<DeleteOutlined />} />
           </Popconfirm>
        </Space>
    )}
  ];

  const renderObraMedicoes = (obraId: string) => {
     const itensObra = data.medicao
       .map((m, i) => ({...m, originalIndex: i}))
       .filter(m => m.obra === obraId)
       .sort((a, b) => dayjs(b.semana).unix() - dayjs(a.semana).unix());

     const totalMedido = itensObra.reduce((acc, curr) => acc + Number(curr.vtotal || 0), 0);
     const avgAvanco = itensObra.length > 0 ? (itensObra.reduce((acc, curr) => acc + Number(curr.avanco || 0), 0) / itensObra.length).toFixed(1) : 0;

     return (
        <div>
           <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Total Medido (Obra)" value={totalMedido} precision={2} prefix="R$" valueStyle={{ color: '#1890ff' }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Média Avanço Mensal" value={avgAvanco} suffix="%" valueStyle={{ color: '#52c41a' }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Total Entregas" value={itensObra.length} prefix={<FileSearchOutlined />} />
                 </Card>
              </Col>
           </Row>

           <Card title={<><InfoCircleOutlined /> Histórico de Produção</>} extra={<Button onClick={() => showDrawer()} type="primary" icon={<PlusOutlined />}>Nova Medição</Button>}>
              <Table 
                 columns={columnsMedicao} 
                 dataSource={itensObra} 
                 rowKey="originalIndex" 
                 pagination={{ pageSize: 15 }} 
              />
           </Card>
        </div>
     );
  };

  const items = data.obras.map(obra => ({
     key: obra.cod,
     label: obra.nome,
     children: renderObraMedicoes(obra.cod)
  }));
  
  const activeObraKey = items[0]?.key;
  const [activeTab, setActiveTab] = useState(activeObraKey);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Medições de Serviço</Title>
          <Text type="secondary">Controle de avanço físico e produção por obra.</Text>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'transparent' }} bodyStyle={{ padding: 0 }}>
         {loading ? (
             <p>Carregando medições...</p>
         ) : items.length > 0 ? (
             <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab}
                items={items} 
                type="card"
                tabBarStyle={{ marginBottom: 24 }}
             />
         ) : (
             <Card>Cadastre uma obra para iniciar as medições.</Card>
         )}
      </Card>

      <MedicaoFormDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        record={editingRecord}
        recordIndex={editingIndex}
        initialObraId={activeTab}
      />
    </div>
  );
}
