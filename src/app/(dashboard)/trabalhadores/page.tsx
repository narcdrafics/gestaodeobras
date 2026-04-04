"use client";

import React, { useState } from "react";
import { Button, Card, Table, Tag, Typography, Tabs, Space, Avatar, Row, Col, Statistic, Popconfirm, Divider } from "antd";
import { UserAddOutlined, CheckSquareOutlined, UserOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useTenantData } from "@/hooks/useTenantData";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { TrabalhadorFormDrawer } from "@/components/trabalhadores/TrabalhadorFormDrawer";
import { PresencaFormDrawer } from "@/components/trabalhadores/PresencaFormDrawer";

const { Title, Text } = Typography;

export default function TrabalhadoresPage() {
  const { data, loading } = useTenantData();
  const { deleteItem } = useFirebaseMutations();
  
  const [trabalhadorDrawerVisible, setTrabalhadorDrawerVisible] = useState(false);
  const [presencaDrawerVisible, setPresencaDrawerVisible] = useState(false);
  
  const [editingTrabalhador, setEditingTrabalhador] = useState<any>(null);
  const [editingTrabalhadorIndex, setEditingTrabalhadorIndex] = useState<number | undefined>(undefined);
  
  const [editingPresenca, setEditingPresenca] = useState<any>(null);
  const [editingPresencaIndex, setEditingPresencaIndex] = useState<number | undefined>(undefined);

  const formatBRL = (val: number) => (Number(val) || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const showTrabalhadorDrawer = (record?: any, index?: number) => {
    setEditingTrabalhador(record || null);
    setEditingTrabalhadorIndex(index);
    setTrabalhadorDrawerVisible(true);
  };

  const showPresencaDrawer = (record?: any, index?: number) => {
    setEditingPresenca(record || null);
    setEditingPresencaIndex(index);
    setPresencaDrawerVisible(true);
  };

  const renderObraStaff = (obraId: string) => {
    // 1. Filtragem Estrita: Apenas trabalhadores vinculados a ESTA obra
    const staff = data.trabalhadores
      .map((t, i) => ({ ...t, originalIndex: i }))
      .filter(t => t.obra === obraId);

    // 2. Presenças vinculadas a ESTA obra
    const presences = data.presenca
      .map((p, i) => ({ ...p, originalIndex: i }))
      .filter(p => p.obra === obraId)
      .sort((a, b) => (dayjs(b.data).unix() - dayjs(a.data).unix())); // Latest first

    const activeCount = staff.filter(s => s.status === "Ativo").length;
    const totalWeeklyCost = presences.slice(0, 50).reduce((acc, p) => acc + Number(p.total || 0), 0);

    const staffColumns = [
      {
        title: 'Profissional',
        key: 'staff',
        render: (_: any, record: any) => (
          <Space>
            <Avatar src={record.fotoUrl} icon={<UserOutlined />} />
            <div>
               <Text strong>{record.nome}</Text><br/>
               <Text type="secondary" style={{ fontSize: 12 }}>{record.funcao}</Text>
            </div>
          </Space>
        )
      },
      {
        title: 'Vínculo',
        dataIndex: 'vinculo',
        key: 'vinculo',
        render: (v: string) => <Tag color={v === "CLT" ? "blue" : (v === "Empreiteiro" ? "gold" : "default")}>{v}</Tag>
      },
      {
        title: 'Diária',
        dataIndex: 'diaria',
        key: 'diaria',
        render: (v: number) => <b>{formatBRL(v)}</b>
      },
      {
        title: 'Status',
        dataIndex: 'status',
        key: 'status',
        render: (s: string) => <Tag color={s === "Ativo" ? "success" : "error"}>{s}</Tag>
      },
      {
        title: 'Ações',
        key: 'actions',
        render: (_: any, record: any) => (
          <Space>
             <Button type="text" icon={<EditOutlined />} onClick={() => showTrabalhadorDrawer(record, record.originalIndex)} />
             <Popconfirm title="Remover cadastro?" onConfirm={() => deleteItem("trabalhadores", record.originalIndex)}>
               <Button type="text" danger icon={<DeleteOutlined />} />
             </Popconfirm>
          </Space>
        )
      }
    ];

    const presenceColumns = [
      {
        title: 'Data',
        dataIndex: 'data',
        key: 'data',
        render: (v: string) => v?.split('-').reverse().join('/')
      },
      {
        title: 'Trabalhador',
        dataIndex: 'trab',
        key: 'trab',
        render: (v: string) => {
           const t = data.trabalhadores.find(x => x.cod === v);
           return t?.nome || v;
        }
      },
      {
        title: 'Tipo',
        dataIndex: 'presenca',
        key: 'presenca',
        render: (v: string) => (
           <Tag color={v === "Presente" ? "success" : (v === "Falta" ? "error" : "warning")}>{v}</Tag>
        )
      },
      {
        title: 'H. Norm/Ext',
        key: 'hours',
        render: (_: any, r: any) => `${r.hnorm || 0}h / ${r.hextra || 0}h`
      },
      {
        title: 'Total Dia',
        dataIndex: 'total',
        key: 'total',
        render: (v: number) => <Text strong>{formatBRL(v)}</Text>
      },
      {
        title: 'Ações',
        key: 'actions',
        render: (_: any, record: any) => (
          <Space>
             <Button type="text" icon={<EditOutlined />} onClick={() => showPresencaDrawer(record, record.originalIndex)} />
             <Popconfirm title="Apagar lançamento?" onConfirm={() => deleteItem("presenca", record.originalIndex)}>
               <Button type="text" danger icon={<DeleteOutlined />} />
             </Popconfirm>
          </Space>
        )
      }
    ];

    return (
      <div>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Trabalhadores Ativos" value={activeCount} prefix={<UserOutlined />} />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless">
               <Statistic title="Custo Últimos 50 Lanç." value={totalWeeklyCost} precision={2} prefix="R$" valueStyle={{ color: '#cf1322' }} />
            </Card>
          </Col>
        </Row>

        <Row gutter={24}>
           <Col span={14}>
              <Card 
                 title={<><UserOutlined /> Quadro de Pessoal</>}
                 extra={<Button icon={<UserAddOutlined />} type="primary" onClick={() => showTrabalhadorDrawer(undefined)}>Add Funcionário</Button>}
              >
                  <Table columns={staffColumns} dataSource={staff} pagination={{ pageSize: 10 }} size="small" rowKey="cod" />
              </Card>
           </Col>
           <Col span={10}>
              <Card 
                 title={<><ClockCircleOutlined /> Lançamentos de Ponto</>}
                 extra={<Button icon={<CheckSquareOutlined />} onClick={() => showPresencaDrawer()}>Lançar Presença</Button>}
              >
                  <Table columns={presenceColumns} dataSource={presences} pagination={{ pageSize: 15 }} size="small" rowKey="originalIndex" />
              </Card>
           </Col>
        </Row>
      </div>
    );
  };

  const items = data.obras.map(obra => ({
    key: obra.cod,
    label: obra.nome,
    children: renderObraStaff(obra.cod)
  }));

  const activeObraKey = items[0]?.key;
  const [activeTab, setActiveTab] = useState(activeObraKey);

  return (
    <div style={{ padding: 24, maxWidth: 1600, margin: '0 auto' }}>
      <div style={{ marginBottom: 24 }}>
         <Title level={2} style={{ margin: 0 }}>Gestão de Pessoal e Presenças</Title>
         <Text type="secondary">Controle diário de frequência, encargos e escala por obra.</Text>
      </div>

      <Card variant="borderless" style={{ background: 'transparent' }} bodyStyle={{ padding: 0 }}>
         {loading ? (
           <p>Sincronizando equipes...</p>
         ) : items.length > 0 ? (
           <Tabs 
             activeKey={activeTab} 
             onChange={setActiveTab}
             items={items} 
             type="card"
             tabBarStyle={{ marginBottom: 24 }}
           />
         ) : (
           <Card>Crie uma Obra para começar a gerir o pessoal.</Card>
         )}
      </Card>

      <TrabalhadorFormDrawer
        visible={trabalhadorDrawerVisible}
        onClose={() => setTrabalhadorDrawerVisible(false)}
        record={editingTrabalhador}
        recordIndex={editingTrabalhadorIndex}
        initialObra={activeTab}
      />

      <PresencaFormDrawer
        visible={presencaDrawerVisible}
        onClose={() => setPresencaDrawerVisible(false)}
        record={editingPresenca}
        recordIndex={editingPresencaIndex}
        initialObraId={activeTab || ""}
      />
    </div>
  );
}

// DayJS import for sorting and formatting
import dayjs from "dayjs";
