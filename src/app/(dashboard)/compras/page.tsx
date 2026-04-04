"use client";

import React, { useState } from "react";
import { Button, Card, Table, Tag, Typography, Tabs, Space, Statistic, Row, Col, Popconfirm, Badge } from "antd";
import { PlusOutlined, DeleteOutlined, ShoppingCartOutlined, TruckOutlined, EditOutlined, FileTextOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { CompraFormDrawer } from "@/components/compras/CompraFormDrawer";
import dayjs from "dayjs";

const { Title, Text } = Typography;

export default function ComprasPage() {
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

  const columnsCompra = [
    { title: 'Solicitação', dataIndex: 'data', key: 'data', render: (val: string) => <Tag>{val?.split('-').reverse().join('/')}</Tag> },
    { title: 'Pedido / Material', dataIndex: 'mat', key: 'mat', render: (text: string, r: any) => <b>{text} <br/> <Text type="secondary" style={{fontSize: 11}}>{r.num} - {r.etapa}</Text></b> },
    { title: 'Fornecedor', dataIndex: 'forn', key: 'forn' },
    { title: 'Valor Total', dataIndex: 'vtotal', key: 'vtotal', render: (val: number, r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{formatBRL(val)}</Text>
          {r.vorc > 0 && val > r.vorc && <Text type="danger" style={{fontSize: 10}}>Acima do orçado!</Text>}
        </Space>
    )},
    { title: 'Status', dataIndex: 'status', key: 'status', render: (val: string) => {
         const colors: any = { 
            'Aprovada': 'success', 
            'Entregue': 'blue', 
            'Aguardando': 'warning', 
            'Pedido Feito': 'purple',
            'Reprovada': 'error',
            'Divergência': 'orange'
         };
         return <Tag color={colors[val] || 'default'}>{val}</Tag>;
    }},
    { title: 'Ações', key: 'actions', render: (_: any, record: any) => (
        <Space>
           <Button type="text" icon={<EditOutlined />} onClick={() => showDrawer(record, record.originalIndex)} />
           <Popconfirm title="Apagar?" onConfirm={() => deleteItem("compras", record.originalIndex)}>
             <Button type="text" danger icon={<DeleteOutlined />} />
           </Popconfirm>
        </Space>
    )}
  ];

  const renderObraCompras = (obraId: string) => {
     const itensObra = data.compras
       .map((c, i) => ({...c, originalIndex: i}))
       .filter(c => c.obra === obraId)
       .sort((a, b) => dayjs(b.data).unix() - dayjs(a.data).unix());

     const totalGeral = itensObra.reduce((acc, curr) => acc + Number(curr.vtotal || 0), 0);
     const entregues = itensObra.filter(c => c.status === "Entregue").length;
     const pendentes = itensObra.filter(c => c.status === "Aguardando" || c.status === "Aprovada" || c.status === "Pedido Feito").length;

     return (
        <div>
           <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Total em Compras (Obra)" value={totalGeral} precision={2} prefix="R$" valueStyle={{ color: '#1890ff' }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Pedidos Entregues" value={entregues} prefix={<TruckOutlined />} valueStyle={{ color: '#52c41a' }} />
                 </Card>
              </Col>
              <Col span={8}>
                 <Card variant="borderless">
                    <Statistic title="Pedidos em Aberto" value={pendentes} prefix={<Badge status="processing" />} valueStyle={{ color: '#faad14' }} />
                 </Card>
              </Col>
           </Row>

           <Card title={<><ShoppingCartOutlined /> Histórico de Suprimentos</>} extra={<Button onClick={() => showDrawer()} type="primary" icon={<PlusOutlined />}>Novo Pedido</Button>}>
              <Table 
                 columns={columnsCompra} 
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
     children: renderObraCompras(obra.cod)
  }));
  
  const activeObraKey = items[0]?.key;
  const [activeTab, setActiveTab] = useState(activeObraKey);

  return (
    <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <Title level={2} style={{ margin: 0 }}>Suprimentos e Compras</Title>
          <Text type="secondary">Gestão de aquisição de materiais e insumos.</Text>
        </div>
      </div>

      <Card variant="borderless" style={{ background: 'transparent' }} bodyStyle={{ padding: 0 }}>
         {loading ? (
             <p>Carregando pedidos...</p>
         ) : items.length > 0 ? (
             <Tabs 
                activeKey={activeTab} 
                onChange={setActiveTab}
                items={items} 
                type="card"
                tabBarStyle={{ marginBottom: 24 }}
             />
         ) : (
             <Card>Cadastre uma obra para iniciar os pedidos de compra.</Card>
         )}
      </Card>

      <CompraFormDrawer
        visible={drawerVisible}
        onClose={() => setDrawerVisible(false)}
        record={editingRecord}
        recordIndex={editingIndex}
        initialObraId={activeTab}
      />
    </div>
  );
}
