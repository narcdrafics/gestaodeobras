"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, DatePicker, App, Row, Col, Alert } from "antd";
import { ToolOutlined, SaveOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import dayjs from "dayjs";

const { Option } = Select;

interface FerramentalFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
}

export function FerramentalFormDrawer({ visible, onClose, record, recordIndex }: FerramentalFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        ...record,
        dataAquisicao: record.dataAquisicao ? dayjs(record.dataAquisicao) : null,
      });
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
        status: "Disponível",
        condicao: "Novo"
      });
    }
  }, [visible, record, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    const payload = {
      ...values,
      dataAquisicao: values.dataAquisicao ? values.dataAquisicao.format("YYYY-MM-DD") : "",
      ultimaAtualizacao: dayjs().format("YYYY-MM-DD HH:mm")
    };

    const success = await saveItem("ferramental", payload, recordIndex !== undefined ? recordIndex : -1);
    if (success) {
      message.success("Equipamento registrado no inventário!");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Equipamento" : "Novo Equipamento / Ferramenta"}
      size="large"
      onClose={onClose}
      open={visible}
      forceRender={true}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading} icon={<SaveOutlined />}>
            Salvar no Inventário
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
           <Col span={16}>
              <Form.Item name="nome" label="Nome do Equipamento" rules={[{ required: true }]}>
                 <Input placeholder="Ex: Martelete Rompedor Bosch 11kg" />
              </Form.Item>
           </Col>
           <Col span={8}>
              <Form.Item name="serie" label="Nº Série / Patrimônio">
                 <Input placeholder="SN-12345" />
              </Form.Item>
           </Col>
        </Row>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="obra" label="Localização Atual (Obra)">
                 <Select placeholder="Onde este item está?">
                    <Option value="">Escritório Central</Option>
                    {data.obras.map(o => <Option key={o.cod} value={o.cod}>{o.nome}</Option>)}
                 </Select>
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="status" label="Status de Disponibilidade">
                 <Select>
                    <Option value="Disponível">Disponível</Option>
                    <Option value="Em Uso">Em Uso (Cautela)</Option>
                    <Option value="Manutenção">Em Manutenção</Option>
                    <Option value="Extraviado">Extraviado / Perda</Option>
                 </Select>
              </Form.Item>
           </Col>
        </Row>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="condicao" label="Condição de Uso">
                 <Select>
                    <Option value="Novo">Novo</Option>
                    <Option value="Bom">Bom Estado</Option>
                    <Option value="Desgastado">Desgastado (Requer Manutenção)</Option>
                    <Option value="Avariado">Avariado / Quebrado</Option>
                 </Select>
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="resp" label="Responsável Atual (Cautela)">
                 <Input placeholder="Ex: Mestre de Obra ou Eletricista" />
              </Form.Item>
           </Col>
        </Row>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="dataAquisicao" label="Data de Aquisição">
                 <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="valor" label="Valor de Compra (R$)">
                 <Input placeholder="R$ 1.500,00" />
              </Form.Item>
           </Col>
        </Row>

        <Form.Item name="obs" label="Observações / Manutenções Realizadas">
           <Input.TextArea rows={4} placeholder="Histórico de trocas de peças, consertos ou detalhes específicos do item..." />
        </Form.Item>

        {record?.status === "Manutenção" && (
           <Alert 
             message="Equipamento em Manutenção" 
             description="Lembre-se de anexar a nota fiscal do conserto no módulo financeiro."
             type="warning"
             showIcon
           />
        )}
      </Form>
    </Drawer>
  );
}
