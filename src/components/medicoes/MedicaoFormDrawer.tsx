"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, Upload, message, Typography, Row, Col } from "antd";
import { UploadOutlined, LoadingOutlined } from "@ant-design/icons";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import { useAuth } from "@/lib/contexts/AuthContext";
import { ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

interface MedicaoFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
  initialObraId?: string;
}

export function MedicaoFormDrawer({ visible, onClose, record, recordIndex, initialObraId }: MedicaoFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  
  const { user } = useAuth();
  const { saveItem } = useFirebaseMutations();
  const { data } = useTenantData();

  const qprev = Form.useWatch('qprev', form) || 0;
  const qreal = Form.useWatch('qreal', form) || 0;
  const vunit = Form.useWatch('vunit', form) || 0;

  useEffect(() => {
    if (visible && record) {
      form.setFieldsValue({
        semana: record.semana ? dayjs(record.semana) : dayjs(),
        obra: record.obra || initialObraId,
        etapa: record.etapa,
        frente: record.frente,
        equipe: record.equipe,
        servico: record.servico,
        unid: record.unid,
        qprev: record.qprev || 0,
        qreal: record.qreal || 0,
        vunit: record.vunit || 0,
        retr: record.retr || "Não",
        status: record.status || "Pendente",
        valpago: record.valpago || 0,
        obs: record.obs,
      });
      setFotoUrl(record.fotoUrl || null);
    } else if (visible) {
      form.resetFields();
      form.setFieldsValue({
         semana: dayjs(),
         obra: initialObraId,
         retr: "Não",
         status: "Pendente",
         qprev: 0,
         qreal: 0,
         vunit: 0
      });
      setFotoUrl(null);
    }
  }, [visible, record, form, initialObraId]);

  const customUploadRequest = async ({ file, onSuccess, onError }: any) => {
    if (!user?.tenantId) return onError("Sem Tenant");
    setUploading(true);
    try {
       const fileRef = storageRef(storage, `tenants/${user.tenantId}/medicoes/${Date.now()}_${file.name}`);
       await uploadBytes(fileRef, file);
       const dlUrl = await getDownloadURL(fileRef);
       setFotoUrl(dlUrl);
       onSuccess("ok");
    } catch (e) {
       onError(e);
       message.error("Erro no upload.");
    } finally {
       setUploading(false);
    }
  };

  const vtotal = Number((qreal * vunit).toFixed(2));
  const avanco = qprev > 0 ? Number(((qreal / qprev) * 100).toFixed(1)) : 0;

  const onFinish = async (values: any) => {
    setLoading(true);
    const payload = {
      semana: values.semana ? values.semana.format("YYYY-MM-DD") : "",
      obra: values.obra,
      etapa: values.etapa || "",
      frente: values.frente || "",
      equipe: values.equipe || "",
      servico: values.servico || "",
      unid: values.unid || "",
      qprev: values.qprev || 0,
      qreal: values.qreal || 0,
      vunit: values.vunit || 0,
      vtotal: vtotal,
      avanco: avanco,
      retr: values.retr,
      status: values.status,
      valpago: values.status === "Parcial" ? values.valpago : (values.status === "Pago" ? vtotal : 0),
      obs: values.obs || "",
      fotoUrl: fotoUrl || ""
    };

    const success = await saveItem("medicao", payload, recordIndex !== undefined ? recordIndex : -1);
    if (success) {
      message.success("Medição salva com sucesso!");
      onClose();
    }
    setLoading(false);
  };

  return (
    <Drawer
      title={record ? "Editar Medição" : "Nova Medição"}
      size="large"
      onClose={onClose}
      open={visible}
      styles={{ body: { paddingBottom: 80 } }}
      extra={
        <Space>
          <Button onClick={onClose}>Cancelar</Button>
          <Button onClick={() => form.submit()} type="primary" loading={loading}>Salvar</Button>
        </Space>
      }
    >
      <Form layout="vertical" form={form} onFinish={onFinish}>
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item name="semana" label="Semana (Data Referência)" rules={[{ required: true }]}>
              <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item name="obra" label="Obra" rules={[{ required: true }]}>
               <Select placeholder="Selecione">
                 {data.obras.map(o => <Option key={o.cod} value={o.cod}>{o.nome}</Option>)}
               </Select>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item name="servico" label="Serviço Executado" rules={[{ required: true }]}>
           <Input placeholder="Ex: Reboco de Parede Externa" />
        </Form.Item>

        <Row gutter={16}>
          <Col span={8}>
            <Form.Item name="etapa" label="Etapa">
              <Input placeholder="Alvenaria" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="frente" label="Frente">
              <Input placeholder="Torre A" />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item name="equipe" label="Equipe">
               <Input placeholder="Empreiteiro Silva" />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={6}>
            <Form.Item name="unid" label="Unid.">
               <Input placeholder="m², m³, etc" />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="qprev" label="Qtd. Prevista">
               <InputNumber style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="qreal" label="Qtd. Realizada">
               <InputNumber style={{ width: '100%' }} step={0.01} />
            </Form.Item>
          </Col>
          <Col span={6}>
            <Form.Item name="vunit" label="Vl. Unit. (R$)">
               <InputNumber style={{ width: '100%' }} precision={2} />
            </Form.Item>
          </Col>
        </Row>

        <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16, display: 'flex', justifyContent: 'space-around', textAlign: 'center' }}>
           <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Valor Total</Text><br/>
              <Text strong style={{ fontSize: 16 }}>R$ {vtotal.toFixed(2)}</Text>
           </div>
           <div>
              <Text type="secondary" style={{ fontSize: 12 }}>Avanço Físico</Text><br/>
              <Text strong style={{ fontSize: 16, color: '#1890ff' }}>{avanco}%</Text>
           </div>
        </div>

        <Row gutter={16}>
           <Col span={12}>
              <Form.Item name="status" label="Status Financeiro">
                 <Select>
                    <Option value="Pendente">Pendente</Option>
                    <Option value="Pago">Pago</Option>
                    <Option value="Parcial">Parcial</Option>
                 </Select>
              </Form.Item>
           </Col>
           <Col span={12}>
              <Form.Item name="retr" label="Retrabalho?">
                 <Select><Option value="Não">Não</Option><Option value="Sim">Sim</Option></Select>
              </Form.Item>
           </Col>
        </Row>

        <Form.Item label="Foto da Medição">
           <Upload customRequest={customUploadRequest} showUploadList={false}>
             <Button icon={uploading ? <LoadingOutlined /> : <UploadOutlined />}>Upload Evidência</Button>
           </Upload>
           {fotoUrl && <img src={fotoUrl} alt="Medição" style={{ width: '100%', marginTop: 12, borderRadius: 8 }} />}
        </Form.Item>

        <Form.Item name="obs" label="Observações">
           <Input.TextArea rows={2} />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
