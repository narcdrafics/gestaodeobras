"use client";

import React, { useState } from 'react';
import { 
  Table, 
  Card, 
  Typography, 
  Button, 
  Space, 
  Tag, 
  Tabs, 
  App, 
  Popconfirm, 
  Tooltip,
  Row,
  Col,
  Statistic
} from 'antd';
import { 
  FileAddOutlined, 
  CheckCircleOutlined, 
  SyncOutlined, 
  CloseCircleOutlined,
  ShoppingCartOutlined,
  SolutionOutlined,
  SendOutlined
} from '@ant-design/icons';
import { useTenantData } from '@/hooks/useTenantData';
import { useFirebaseMutations } from '@/hooks/useFirebaseMutations';
import { RequisicaoFormDrawer } from '@/components/compras/RequisicaoFormDrawer';
import dayjs from 'dayjs';

const { Title, Text } = Typography;

export default function RequisicoesPage() {
  const { data, loading } = useTenantData();
  const { saveItem, deleteItem } = useFirebaseMutations();
  const { message } = App.useApp();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any>(null);
  const [loadingAction, setLoadingAction] = useState(false);

  const requisicoesComp = data.requisicoes.map((r, i) => ({ ...r, originalIndex: i }));

  const approveRequest = async (record: any, index: number) => {
    setLoadingAction(true);
    try {
      // 1. Criar o Pedido de Compra
      const novoPedido = {
         num: `PED-REQ-${Math.floor(Math.random() * 9000) + 1000}`,
         data: dayjs().format("YYYY-MM-DD"),
         obra: record.obra,
         etapa: record.etapa || "",
         mat: record.mat,
         qtd: record.qtd,
         unid: record.unid || "",
         status: "Aguardando",
         forn: "",
         vunit: 0,
         vtotal: 0,
         vorc: 0,
         obs: `Gerado da Requisição #${record.num}`,
         requisicaoRef: record.num
      };
      
      const p1 = await saveItem("compras", novoPedido);
      
      // 2. Atualizar status da requisição
      const p2 = await saveItem("requisicoes", {
         ...record,
         status: "Aprovada",
         dataAprovacao: dayjs().format("YYYY-MM-DD")
      }, index);

      if (p1 && p2) {
         message.success("Requisição aprovada e Pedido de Compra gerado!");
      }
    } catch (e) {
      console.error(e);
      message.error("Falha ao processar aprovação.");
    } finally {
      setLoadingAction(false);
    }
  };

  const columns = [
    {
      title: 'Cód / Data',
      key: 'info',
      render: (r: any) => (
        <Space direction="vertical" size={0}>
          <Text strong>{r.num}</Text>
          <Text type="secondary" style={{ fontSize: 11 }}>{r.data ? dayjs(r.data).format('DD/MM/YYYY') : '-'}</Text>
        </Space>
      )
    },
    {
      title: 'Obra',
      dataIndex: 'obra',
      key: 'obra',
      render: (cod: string) => data.obras.find(o => o.cod === cod)?.nome || cod
    },
    {
      title: 'Material',
      dataIndex: 'mat',
      key: 'mat',
      render: (t: string) => <Text strong>{t}</Text>
    },
    {
       title: 'Qtd.',
       key: 'qtd',
       render: (r: any) => `${r.qtd} ${r.unid || ''}`
    },
    {
      title: 'Solicitante',
      dataIndex: 'solicitante',
      key: 'solicitante'
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => {
        let color = "default";
        let icon = <SyncOutlined spin />;
        if (s === "Aprovada") { color = "success"; icon = <CheckCircleOutlined />; }
        if (s === "Recusada") { color = "error"; icon = <CloseCircleOutlined />; }
        if (s === "Pendente") { color = "processing"; icon = <SyncOutlined />; }
        return <Tag color={color} icon={icon}>{s}</Tag>;
      }
    },
    {
      title: 'Ações',
      key: 'actions',
      render: (_: any, record: any) => (
        <Space>
           {record.status === "Pendente" && (
              <>
                 <Tooltip title="Aprovar e Gerar Pedido">
                    <Button 
                      icon={<CheckCircleOutlined />} 
                      type="primary" 
                      size="small" 
                      onClick={() => approveRequest(record, record.originalIndex)}
                      loading={loadingAction}
                    />
                 </Tooltip>
                 <Button 
                   icon={<CloseCircleOutlined />} 
                   danger 
                   size="small" 
                   onClick={() => saveItem("requisicoes", { ...record, status: "Recusada" }, record.originalIndex)}
                 />
              </>
           )}
           <Button 
             size="small" 
             onClick={() => { setSelectedRecord(record); setIsDrawerOpen(true); }}
           >
             Editar
           </Button>
           <Popconfirm title="Remover requisição?" onConfirm={() => deleteItem("requisicoes", record.originalIndex)}>
              <Button size="small" danger type="text">Excluir</Button>
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
             <SolutionOutlined style={{ marginRight: 8 }} />
             Requisições de Material
          </Title>
          <Text type="secondary">Solicitações do pessoal de campo para o escritório</Text>
        </Col>
        <Col>
           <Button 
             type="primary" 
             icon={<FileAddOutlined />} 
             size="large"
             onClick={() => { setSelectedRecord(null); setIsDrawerOpen(true); }}
           >
             Nova Requisição
           </Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Pendentes" value={requisicoesComp.filter(r => r.status === "Pendente").length} prefix={<SyncOutlined />} />
            </Card>
         </Col>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Aprovadas (Mês)" value={requisicoesComp.filter(r => r.status === "Aprovada").length} prefix={<CheckCircleOutlined />} />
            </Card>
         </Col>
         <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Total Gerado R$" value={data.compras.filter(c => c.requisicaoRef).reduce((acc, c) => acc + (c.vtotal || 0), 0)} precision={2} prefix={<ShoppingCartOutlined />} />
            </Card>
         </Col>
      </Row>

      <Card variant="borderless">
        <Tabs
          defaultActiveKey="1"
          items={[
            {
              key: '1',
              label: 'Pendentes',
              children: <Table rowKey="originalIndex" columns={columns} dataSource={requisicoesComp.filter(r => r.status === "Pendente")} loading={loading} />
            },
            {
              key: '2',
              label: 'Histórico Completo',
              children: <Table rowKey="originalIndex" columns={columns} dataSource={requisicoesComp} loading={loading} />
            }
          ]}
        />
      </Card>

      <RequisicaoFormDrawer 
        visible={isDrawerOpen} 
        onClose={() => setIsDrawerOpen(false)} 
        record={selectedRecord}
        recordIndex={selectedRecord?.originalIndex}
      />
    </div>
  );
}
