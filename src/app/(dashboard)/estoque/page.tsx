"use client";

import React, { useState } from 'react';
import { 
  Table, 
  Card, 
  Typography, 
  Select, 
  Button, 
  Space, 
  Input, 
  Row, 
  Col, 
  Statistic, 
  Empty, 
  Tag, 
  Modal, 
  Form, 
  InputNumber,
  App
} from 'antd';
import { 
  DatabaseOutlined, 
  SearchOutlined, 
  PlusOutlined, 
  MinusCircleOutlined,
  HistoryOutlined,
  ShopOutlined
} from '@ant-design/icons';
import { useTenantData } from '@/hooks/useTenantData';
import { useFirebaseMutations } from '@/hooks/useFirebaseMutations';

const { Title, Text } = Typography;
const { Option } = Select;

export default function EstoquePage() {
  const { data, loading } = useTenantData();
  const { saveItem } = useFirebaseMutations();
  const { message } = App.useApp();
  const [selectedObra, setSelectedObra] = useState<string>("TODAS");
  const [search, setSearch] = useState("");
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState(false);
  const [form] = Form.useForm();

  // Filtragem do estoque
  const estoqueFiltrado = data.estoque.map((item, index) => ({ ...item, originalIndex: index }))
    .filter(item => {
      const matchObra = selectedObra === "TODAS" || item.obra === selectedObra;
      const matchSearch = item.mat?.toLowerCase().includes(search.toLowerCase());
      return matchObra && matchSearch;
    });

  const handleAdjust = async (values: any) => {
    setLoadingAction(true);
    try {
      const itemIdx = data.estoque.findIndex((e: any) => e.mat === values.mat && e.obra === values.obra);
      
      if (itemIdx >= 0) {
        const itemExistente = data.estoque[itemIdx];
        const novaQtd = values.tipo === "adicao" 
          ? Number(itemExistente.qtd || 0) + values.qtd 
          : Math.max(0, Number(itemExistente.qtd || 0) - values.qtd);
        
        await saveItem("estoque", {
          ...itemExistente,
          qtd: novaQtd,
          ultimaAtualizacao: new Date().toISOString()
        }, itemIdx);
        message.success("Estoque ajustado com sucesso!");
      } else if (values.tipo === "adicao") {
        await saveItem("estoque", {
          mat: values.mat,
          qtd: values.qtd,
          unid: values.unid || "unid",
          obra: values.obra,
          ultimaAtualizacao: new Date().toISOString()
        });
        message.success("Novo item adicionado ao estoque!");
      } else {
        message.error("Não é possível dar baixa em um item inexistente.");
      }
      setIsAdjustModalOpen(false);
      form.resetFields();
    } catch (error) {
      console.error(error);
      message.error("Erro ao ajustar estoque.");
    } finally {
      setLoadingAction(false);
    }
  };

  const columns = [
    {
      title: 'Material',
      dataIndex: 'mat',
      key: 'mat',
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: 'Site / Obra',
      dataIndex: 'obra',
      key: 'obra',
      render: (obraId: string) => {
        const obra = data.obras.find(o => o.cod === obraId);
        return <Tag color="blue">{obra?.nome || obraId}</Tag>;
      },
    },
    {
      title: 'Quantidade',
      dataIndex: 'qtd',
      key: 'qtd',
      render: (qtd: number, record: any) => (
        <Space>
          <Text strong style={{ color: qtd < 5 ? '#cf1322' : 'inherit', fontSize: 16 }}>{qtd}</Text>
          <Text type="secondary">{record.unid}</Text>
        </Space>
      ),
    },
    {
      title: 'Última Movimentação',
      dataIndex: 'ultimaAtualizacao',
      key: 'ultimaAtualizacao',
      render: (date: string) => <Text type="secondary" style={{ fontSize: 12 }}>{date ? new Date(date).toLocaleDateString() : '-'}</Text>,
    },
    {
      title: 'Status',
      key: 'status',
      render: (_: any, record: any) => (
        record.qtd < 5 ? <Tag color="error">Estoque Baixo</Tag> : <Tag color="success">Disponível</Tag>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Row gutter={[16, 16]} justify="space-between" align="middle" style={{ marginBottom: 24 }}>
        <Col>
          <Title level={2} style={{ margin: 0 }}>
            <DatabaseOutlined style={{ marginRight: 8 }} />
            Gestão de Estoque
          </Title>
          <Text type="secondary">Controle de materiais físicos por obra</Text>
        </Col>
        <Col>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            size="large"
            onClick={() => setIsAdjustModalOpen(true)}
            style={{ borderRadius: 8 }}
          >
            Ajustar Estoque
          </Button>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic 
              title="Itens Diferentes" 
              value={new Set(data.estoque.map(e => e.mat)).size} 
              prefix={<ShopOutlined />} 
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card variant="borderless">
            <Statistic 
              title="Obras com Estoque" 
              value={new Set(data.estoque.map(e => e.obra)).size} 
              prefix={<HistoryOutlined />} 
            />
          </Card>
        </Col>
        <Col span={12}>
           <Card variant="borderless">
              <Space size="large" style={{ width: '100%', justifyContent: 'flex-end' }}>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text type="secondary" style={{ marginBottom: 4 }}>Filtrar por Obra</Text>
                    <Select 
                      value={selectedObra} 
                      onChange={setSelectedObra} 
                      style={{ width: 250 }}
                      size="large"
                    >
                      <Option value="TODAS">Todas as Obras</Option>
                      {data.obras.map(o => (
                        <Option key={o.cod} value={o.cod}>{o.nome}</Option>
                      ))}
                    </Select>
                 </div>
                 <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <Text type="secondary" style={{ marginBottom: 4 }}>Pesquisar Material</Text>
                    <Input 
                      placeholder="Cimento, Areia..." 
                      prefix={<SearchOutlined />} 
                      value={search}
                      onChange={e => setSearch(e.target.value)}
                      size="large"
                      style={{ width: 250 }}
                    />
                 </div>
              </Space>
           </Card>
        </Col>
      </Row>

      <Card variant="borderless" style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.05)' }}>
        <Table 
          columns={columns} 
          dataSource={estoqueFiltrado} 
          loading={loading}
          rowKey="originalIndex"
          locale={{ emptyText: <Empty description="Nenhum material em estoque para os filtros selecionados" /> }}
        />
      </Card>

      <Modal
        title="Ajuste Manual de Estoque"
        open={isAdjustModalOpen}
        onCancel={() => setIsAdjustModalOpen(false)}
        onOk={() => form.submit()}
        confirmLoading={loadingAction}
        destroyOnHidden
      >
        <Form form={form} layout="vertical" onFinish={handleAdjust} initialValues={{ tipo: 'adicao' }}>
          <Form.Item name="obra" label="Obra" rules={[{ required: true }]}>
            <Select placeholder="Selecione a Obra">
              {data.obras.map(o => (
                <Option key={o.cod} value={o.cod}>{o.nome}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="mat" label="Material" rules={[{ required: true }]}>
            <Input placeholder="Ex: Cimento CP-II" />
          </Form.Item>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="qtd" label="Quantidade" rules={[{ required: true }]}>
                <InputNumber min={1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="unid" label="Unidade" rules={[{ required: true }]}>
                <Input placeholder="Saco, kg, m³" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="tipo" label="Tipo de Ajuste" rules={[{ required: true }]}>
            <Select>
              <Option value="adicao">Entrada / Adição (+)</Option>
              <Option value="baixa">Saída / Consumo (-)</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
