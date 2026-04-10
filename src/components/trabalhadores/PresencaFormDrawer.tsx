"use client";

import React, { useEffect, useState } from "react";
import { Drawer, Form, Input, Select, Button, Space, InputNumber, DatePicker, Checkbox, App, Typography, Row, Col, Divider } from "antd";
import { useFirebaseMutations } from "@/hooks/useFirebaseMutations";
import { useTenantData } from "@/hooks/useTenantData";
import { CheckSquareOutlined } from "@ant-design/icons";
import dayjs from "dayjs";

const { Option } = Select;
const { Text } = Typography;

interface PresencaFormDrawerProps {
  visible: boolean;
  onClose: () => void;
  record?: any;
  recordIndex?: number;
  initialObraId: string;
}

export function PresencaFormDrawer({ visible, onClose, record, recordIndex, initialObraId }: PresencaFormDrawerProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const { message } = App.useApp();
  const [mode, setMode] = useState<"individual" | "massa">("individual");
  const [selectedMassa, setSelectedMassa] = useState<string[]>([]);
  const [searchMassa, setSearchMassa] = useState("");
  
  const { saveItem, saveItems } = useFirebaseMutations();
  const { data } = useTenantData();

  // Watchers for individual mode
  const selectedTrabId = Form.useWatch('trab', form);
  const presencaType = Form.useWatch('presenca', form);
  const hnorm = Form.useWatch('hnorm', form) || 0;
  const hextra = Form.useWatch('hextra', form) || 0;

  useEffect(() => {
    if (visible && record) {
      setMode("individual");
      form.setFieldsValue({
        data: record.data ? dayjs(record.data) : dayjs(),
        obra: record.obra || initialObraId,
        trab: record.trab,
        frente: record.frente,
        presenca: record.presenca || "Presente",
        entrada: record.entrada || "07:00",
        saida: record.saida || "17:00",
        hnorm: record.hnorm || 8,
        hextra: record.hextra || 0,
        diaria: record.diaria || 0,
        total: record.total || 0,
        obs: record.obs,
        status: record.status || "Pendente",
        valpago: record.valpago || 0,
        lancador: record.lancador,
      });
    } else if (visible) {
      form.resetFields();
      setMode("individual");
      form.setFieldsValue({
         data: dayjs(),
         obra: initialObraId,
         presenca: "Presente",
         hnorm: 8,
         hextra: 0,
         status: "Pendente"
      });
    }
  }, [visible, record, form, initialObraId]);

  // Update worker info when selected
  useEffect(() => {
    if (selectedTrabId && mode === "individual") {
       const worker = data.trabalhadores.find(t => t.cod === selectedTrabId);
       if (worker) {
          form.setFieldsValue({
             diaria: worker.diaria || 0,
             funcao: worker.funcao || ""
          });
          calcTotal();
       }
    }
  }, [selectedTrabId, data.trabalhadores, mode, form]);

  // Auto calculate total
  const calcTotal = () => {
     const worker = data.trabalhadores.find(t => t.cod === selectedTrabId);
     if (!worker) return;
     
     const diaria = Number(worker.diaria || 0);
     const tipo = form.getFieldValue('presenca');
     
     let total = 0;
     if (tipo === "Presente") {
        total = diaria + (hextra * (diaria / 8) * 1.5); // Example: 50% extra pay for HE
     } else if (tipo === "Meio período") {
        total = diaria / 2;
     } else {
        total = 0;
     }
     form.setFieldsValue({ total: Number(total.toFixed(2)) });
  };

  useEffect(() => {
     if (mode === "individual") calcTotal();
  }, [presencaType, hnorm, hextra]);

  const onFinishMassa = async (values: any) => {
    if (selectedMassa.length === 0) {
       message.warning("Selecione ao menos um trabalhador.");
       return;
    }
    setLoading(true);
    
    const payloads = selectedMassa.map(trabCod => {
       const worker = data.trabalhadores.find(t => t.cod === trabCod);
       return {
          data: values.data.format("YYYY-MM-DD"),
          obra: initialObraId,
          trab: trabCod,
          nome: worker?.nome || "",
          presenca: "Presente",
          hnorm: 8,
          hextra: 0,
          diaria: worker?.diaria || 0,
          total: worker?.diaria || 0,
          status: "Pendente",
          lancador: values.lancador || ""
       };
    });

    const success = await saveItems("presenca", payloads);
    if (success) {
       message.success(`${payloads.length} presenças lançadas com sucesso!`);
       onClose();
    }
    setLoading(false);
  };

  const onFinishIndividual = async (values: any) => {
    setLoading(true);
    const worker = data.trabalhadores.find(t => t.cod === values.trab);
    
    const payload = {
      data: values.data.format("YYYY-MM-DD"),
      obra: initialObraId,
      trab: values.trab,
      nome: worker?.nome || "",
      frente: values.frente || "",
      presenca: values.presenca,
      entrada: values.entrada || "",
      saida: values.saida || "",
      hnorm: values.hnorm || 0,
      hextra: values.hextra || 0,
      diaria: values.diaria || 0,
      total: values.total || 0,
      obs: values.obs || "",
      status: values.status || "Pendente",
      valpago: values.status === "Parcial" ? values.valpago : (values.status === "Pago" ? values.total : 0),
      lancador: values.lancador || ""
    };

    const success = await saveItem("presenca", payload, recordIndex !== undefined ? recordIndex : -1);
    if (success) {
      message.success("Presença salva!");
      onClose();
    }
    setLoading(false);
  };

  const workersOfThisObra = data.trabalhadores.filter(t => t.obra === initialObraId && t.status !== "Inativo");
  const workersFiltered = workersOfThisObra.filter(t => t.nome?.toLowerCase().includes(searchMassa.toLowerCase()));

  return (
    <Drawer
      title={record ? "Editar Presença" : "Lançar Presença"}
      size={mode === "individual" ? "default" : "large"}
      onClose={onClose}
      open={visible}
      forceRender={true}
      styles={{ body: { paddingBottom: 80 } }}
    >
      {!record && (
         <div style={{ marginBottom: 24, textAlign: 'center' }}>
            <Space.Compact style={{ width: '100%' }}>
               <Button type={mode === "individual" ? "primary" : "default"} onClick={() => setMode("individual")} style={{ width: '50%' }}>Individual</Button>
               <Button type={mode === "massa" ? "primary" : "default"} onClick={() => setMode("massa")} style={{ width: '50%' }}>Em Massa 🚀</Button>
            </Space.Compact>
         </div>
      )}

      <Form layout="vertical" form={form} onFinish={mode === "individual" ? onFinishIndividual : onFinishMassa}>
        
        <Form.Item name="data" label="Data de Referência" rules={[{ required: true }]}>
          <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
        </Form.Item>

        {mode === "individual" ? (
           <>
              <Form.Item name="trab" label="Trabalhador" rules={[{ required: true }]}>
                <Select placeholder="Selecione o profissional" showSearch optionFilterProp="children">
                   {workersOfThisObra.map(t => (
                      <Option key={t.cod} value={t.cod}>{t.nome}</Option>
                   ))}
                </Select>
              </Form.Item>

              <Row gutter={16}>
                 <Col span={12}>
                    <Form.Item name="presenca" label="Tipo de Presença">
                      <Select>
                         <Option value="Presente">Presente</Option>
                         <Option value="Falta">Falta</Option>
                         <Option value="Meio período">Meio período</Option>
                      </Select>
                    </Form.Item>
                 </Col>
                 <Col span={12}>
                    <Form.Item name="frente" label="Frente de Serviço">
                       <Input placeholder="Fase / Local" />
                    </Form.Item>
                 </Col>
              </Row>

              {presencaType !== "Falta" && (
                 <Row gutter={16}>
                    <Col span={12}>
                       <Form.Item name="hnorm" label="H. Normais">
                          <InputNumber style={{ width: '100%' }} step={0.5} />
                       </Form.Item>
                    </Col>
                    <Col span={12}>
                       <Form.Item name="hextra" label="H. Extras">
                          <InputNumber style={{ width: '100%' }} step={0.5} />
                       </Form.Item>
                    </Col>
                 </Row>
              )}

              <div style={{ background: '#f5f5f5', padding: 16, borderRadius: 8, marginBottom: 16 }}>
                 <Row gutter={16}>
                    <Col span={12}>
                       <Text type="secondary" style={{ fontSize: 12 }}>Valor Diária</Text><br/>
                       <Text strong>R$ {form.getFieldValue('diaria') || 0}</Text>
                    </Col>
                    <Col span={12}>
                       <Text type="secondary" style={{ fontSize: 12 }}>Total Calculado</Text><br/>
                       <Text strong style={{ fontSize: 18, color: '#1890ff' }}>R$ {form.getFieldValue('total') || 0}</Text>
                    </Col>
                 </Row>
              </div>

              <Form.Item name="status" label="Status Financeiro">
                 <Select>
                    <Option value="Pendente">A pagar (Pendente)</Option>
                    <Option value="Pago">Pago</Option>
                    <Option value="Parcial">Parcial</Option>
                 </Select>
              </Form.Item>

              <Form.Item name="lancador" label="Anotado por">
                 <Input />
              </Form.Item>

              <Form.Item name="obs" label="Observações">
                 <Input.TextArea rows={2} />
              </Form.Item>
           </>
        ) : (
           <>
              <Divider>Selecione os profissionais presentes</Divider>
              <Input 
                 placeholder="Filtrar por nome ou equipe..." 
                 style={{ marginBottom: 16 }} 
                 onChange={(e) => setSearchMassa(e.target.value)}
                 prefix={<CheckSquareOutlined style={{ color: '#bfbfbf' }} />}
               />
              <div style={{ border: '1px solid #d9d9d9', borderRadius: 8, padding: 16, maxHeight: 300, overflowY: 'auto', marginBottom: 24 }}>
                 <Checkbox.Group 
                    value={selectedMassa} 
                    onChange={(vals) => setSelectedMassa(vals as string[])}
                    style={{ width: '100%' }}
                 >
                    <Row gutter={[16, 8]}>
                       {workersFiltered.map(t => (
                          <Col span={12} key={t.cod}>
                             <Checkbox value={t.cod}>{t.nome}</Checkbox>
                          </Col>
                       ))}
                       {workersFiltered.length === 0 && <Text type="secondary">Nenhum trabalhador encontrado.</Text>}
                    </Row>
                 </Checkbox.Group>
              </div>
              
              <Form.Item name="lancador" label="Lançado por (Equipe)">
                 <Input />
              </Form.Item>

              <Text type="secondary" style={{ fontSize: 12 }}>* No modo em massa, as presenças são criadas como "Presente" com 8.0h padrão e o valor das diárias originais do cadastro.</Text>
           </>
        )}

        <div style={{ marginTop: 24 }}>
            <Button type="primary" block size="large" onClick={() => form.submit()} loading={loading}>
               {record ? "Salvar Alterações" : "Confirmar Lançamento"}
            </Button>
        </div>
      </Form>
    </Drawer>
  );
}
