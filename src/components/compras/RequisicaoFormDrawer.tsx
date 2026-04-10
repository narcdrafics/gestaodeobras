"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, App, Row, Col } from "antd";
import { SolutionOutlined, SendOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import dayjs from "dayjs";

const { Option } = Select;

interface RequisicaoFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
}

export function RequisicaoFormDrawer({ visible, onClose, record, recordIndex }: RequisicaoFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        ...record,
        data: record.data ? dayjs(record.data) : dayjs(),
      });
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
        data: dayjs(),
        status: "Pendente",
        num: `REQ-${Math.floor(Math.random() * 90000) + 10000}`
      });
    }
  }, [visible, record, form]);

  const onFinish = async (values: any) => {
    setLoading(true);
    const payload = {
      ...values,
      data: values.data ? values.data.format("YYYY-MM-DD") : dayjs().format("YYYY-MM-DD"),
      num: values.num || `REQ-${Math.floor(Math.random() * 90000) + 10000}`,
      status: record?.status || "Pendente"
    };

    const success = await saveItem("requisicoes", payload, recordIndex !== undefined ? recordIndex : -1);
    if (success) {
      message.success("Requisição enviada com sucesso!");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Requisição" : "Nova Requisição de Material"}
      size="large"
      onClose={onClose}
      open={visible}
      forceRender={true}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading} icon={<SendOutlined />}>
            Enviar Requisição
          </Button>
        </Space>
      }
    >
      <Form form={form} layout="vertical" onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={12}>
             <Form.Item name="num" label="Número">
                <Input readOnly style={{ background: '#f5f5f5' }} />
             </Form.Item>
          </Col>
          <Col span={12}>
             <Form.Item name="data" label="Data Solicitação" rules={[{ required: true }]}>
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
             </Form.Item>
          </Col>
        </Row>

        <Form.Item name="obra" label="Obra Destino" rules={[{ required: true, message: 'Selecione a obra' }]}>
           <Select placeholder="Onde o material será usado?">
              {data.obras.map(o => <Option key={o.cod} value={o.cod}>{o.nome}</Option>)}
           </Select>
        </Form.Item>

        <Form.Item name="mat" label="Material / Serviço" rules={[{ required: true, message: 'O que você precisa?' }]}>
           <Input placeholder="Ex: Areia grossa, Cimento, Aluguel de caçamba..." />
        </Form.Item>
        
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="qtd" label="Quantidade Aproximada" rules={[{ required: true }]}>
               <InputNumber style={{ width: '100%' }} min={0.1} step={1} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="unid" label="Unidade">
               <Input placeholder="Sc, m³, kg, unid..." />
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="etapa" label="Etapa da Obra (Opcional)">
           <Input placeholder="Ex: Alvenaria do 1º andar" />
        </Form.Item>

        <Form.Item name="solicitante" label="Seu Nome / Responsável" rules={[{ required: true }]}>
           <Input placeholder="Ex: Mestre João" />
        </Form.Item>

        <Form.Item name="obs" label="Observações Adicionais / Justificativa">
           <Input.TextArea rows={4} placeholder="Descreva por que e para quando precisa deste material..." />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
