'use client';

import React, { useState } from 'react';
import { PersonaAdmin, Rol } from '@/lib/session';
import {
  listarPersonal,
  crearPersona,
  resetearPinDePersona,
  cambiarEstadoDePersona,
} from '@/app/actions/personal';
import { toast } from '@/components/ui/Toast';
import { PinPad } from '@/components/ui/PinPad';
import { IconReceipt, IconChefHat, IconCrown, IconCode, IconLock, IconPlus } from '@/components/ui/Icons';
import styles from './PersonalManager.module.css';

const ROLES: { valor: Rol; etiqueta: React.ReactNode; explicacion: string }[] = [
  { valor: 'cajero', etiqueta: <><IconReceipt size={14} /> Caja y pedidos</>, explicacion: 'Toma pedidos y cobra' },
  { valor: 'cocina', etiqueta: <><IconChefHat size={14} /> Cocina</>, explicacion: 'Solo ve el tablero de cocina' },
  { valor: 'admin', etiqueta: <><IconCrown size={14} /> Administración</>, explicacion: 'Todo, incluido este dashboard' },
  { valor: 'dev', etiqueta: <><IconCode size={14} /> Dev / Tester</>, explicacion: 'Igual que administración, para pruebas' },
];

/** PIN temporal sugerido: 4 dígitos que no sean obvios ni repetidos */
function pinTemporalSugerido() {
  let pin = '';
  do {
    pin = String(Math.floor(1000 + Math.random() * 9000));
  } while (/^(.)\1{3}$/.test(pin) || pin === '1234' || pin === '4321');
  return pin;
}

/**
 * Administración del personal: dar de alta, resetear PIN y activar o
 * desactivar a alguien.
 *
 * Todo exige el PIN de administración, no basta con tener el dashboard
 * abierto. Se pide una vez y se conserva mientras dure la pantalla.
 */
export const PersonalManager: React.FC = () => {
  const [adminPin, setAdminPin] = useState('');
  const [pinIngresado, setPinIngresado] = useState('');
  const [personal, setPersonal] = useState<PersonaAdmin[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Alta de una persona nueva
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [rol, setRol] = useState<Rol>('cajero');
  const [pinTemporal, setPinTemporal] = useState(pinTemporalSugerido);

  const desbloquear = async (pin: string) => {
    setCargando(true);
    setError('');
    const res = await listarPersonal(pin);
    setCargando(false);

    if (!res.success) {
      setError(res.error);
      setPinIngresado('');
      return;
    }

    setAdminPin(pin);
    setPersonal(res.personal);
  };

  const recargar = async () => {
    const res = await listarPersonal(adminPin);
    if (res.success) setPersonal(res.personal);
  };

  const guardarPersona = async () => {
    if (!nombre.trim()) {
      toast.error('Escribe el nombre de la persona.');
      return;
    }

    setCargando(true);
    const res = await crearPersona(adminPin, nombre.trim(), rol, pinTemporal);
    setCargando(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    toast.success(
      `${nombre.trim()} ya puede entrar con el PIN temporal ${pinTemporal}. Al entrar tendrá que elegir el suyo.`
    );
    setNombre('');
    setRol('cajero');
    setPinTemporal(pinTemporalSugerido());
    setCreando(false);
    await recargar();
  };

  const resetear = async (persona: PersonaAdmin) => {
    const temporal = pinTemporalSugerido();
    setCargando(true);
    const res = await resetearPinDePersona(adminPin, persona.id, temporal);
    setCargando(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    toast.success(`PIN temporal de ${persona.nombre}: ${temporal}. Tendrá que elegir el suyo al entrar.`);
    await recargar();
  };

  const alternarEstado = async (persona: PersonaAdmin) => {
    setCargando(true);
    const res = await cambiarEstadoDePersona(adminPin, persona.id, !persona.activo);
    setCargando(false);

    if (!res.success) {
      toast.error(res.error);
      return;
    }

    toast.success(`${persona.nombre} quedó ${persona.activo ? 'desactivado' : 'activo'}.`);
    await recargar();
  };

  /* ── Todavía no se ha demostrado ser administración ── */
  if (!adminPin) {
    return (
      <div className={styles.bloqueado}>
        <h3 className={styles.bloqueadoTitulo}>
          <IconLock size={18} style={{ marginRight: '6px', verticalAlign: '-3px' }} />
          Marca tu PIN para administrar el personal
        </h3>
        <p className={styles.bloqueadoTexto}>
          Crear personas, resetear PINes y dar de baja exige tu PIN, no solo tener el
          dashboard abierto.
        </p>

        {error && <div className={styles.error}>{error}</div>}

        <PinPad
          valor={pinIngresado}
          onChange={setPinIngresado}
          onCompleto={desbloquear}
          disabled={cargando}
          autoFocus={false}
        />
      </div>
    );
  }

  return (
    <div className={styles.contenedor}>
      <div className={styles.cabecera}>
        <p className={styles.ayuda}>
          Cada persona elige su propio PIN la primera vez que entra. Tú nunca lo ves: si
          alguien lo olvida, se le genera uno temporal y vuelve a elegir.
        </p>
        <button
          type="button"
          className={styles.nuevoBtn}
          onClick={() => setCreando((prev) => !prev)}
          disabled={cargando}
        >
          {creando ? 'Cancelar' : <><IconPlus size={14} style={{ marginRight: '4px', verticalAlign: '-2px' }} />Nueva persona</>}
        </button>
      </div>

      {creando && (
        <div className={styles.formulario}>
          <label className={styles.campo}>
            <span className={styles.etiqueta}>Nombre</span>
            <input
              type="text"
              className={styles.input}
              placeholder="Ej: Simón"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              maxLength={60}
              disabled={cargando}
              autoFocus
            />
          </label>

          <div className={styles.campo}>
            <span className={styles.etiqueta}>¿Qué hace?</span>
            <div className={styles.roles}>
              {ROLES.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  className={`${styles.rolBtn} ${rol === opcion.valor ? styles.rolActivo : ''}`}
                  onClick={() => setRol(opcion.valor)}
                  disabled={cargando}
                >
                  <strong className={styles.rolEtiqueta}>{opcion.etiqueta}</strong>
                  <span>{opcion.explicacion}</span>
                </button>
              ))}
            </div>
          </div>

          <div className={styles.temporalCaja}>
            <span className={styles.etiqueta}>PIN temporal para que entre la primera vez</span>
            <div className={styles.temporalFila}>
              <span className={styles.temporalPin}>{pinTemporal}</span>
              <button
                type="button"
                className={styles.otroPinBtn}
                onClick={() => setPinTemporal(pinTemporalSugerido())}
                disabled={cargando}
              >
                Generar otro
              </button>
            </div>
            <span className={styles.temporalNota}>
              Díselo de viva voz. Al entrar, la app lo obliga a cambiarlo por uno suyo.
            </span>
          </div>

          <button
            type="button"
            className={styles.guardarBtn}
            onClick={guardarPersona}
            disabled={cargando || !nombre.trim()}
          >
            {cargando ? 'Guardando…' : 'Dar de alta'}
          </button>
        </div>
      )}

      <div className={styles.tablaWrapper}>
        <table className={styles.tabla}>
          <thead>
            <tr>
              <th className={styles.th}>Persona</th>
              <th className={styles.th}>Rol</th>
              <th className={styles.th}>Estado</th>
              <th className={styles.th}>Último ingreso</th>
              <th className={styles.th}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {personal.map((persona) => (
              <tr key={persona.id} className={persona.activo ? styles.fila : styles.filaInactiva}>
                <td className={styles.td}>
                  <span className={styles.nombre}>{persona.nombre}</span>
                  {persona.debe_cambiar_pin && (
                    <span className={styles.tagPendiente}>PIN temporal sin cambiar</span>
                  )}
                  {persona.bloqueado && (
                    <span className={styles.tagBloqueado}>Bloqueado por intentos fallidos</span>
                  )}
                </td>
                <td className={styles.td}>
                  {ROLES.find((r) => r.valor === persona.rol)?.etiqueta ?? persona.rol}
                </td>
                <td className={styles.td}>
                  {persona.activo ? (
                    <span className={styles.activo}>Activo</span>
                  ) : (
                    <span className={styles.inactivo}>Inactivo</span>
                  )}
                </td>
                <td className={styles.td}>
                  {persona.ultimo_ingreso
                    ? new Date(persona.ultimo_ingreso).toLocaleString('es-CO', {
                        timeZone: 'America/Bogota',
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'Nunca'}
                </td>
                <td className={styles.td}>
                  <div className={styles.acciones}>
                    <button
                      type="button"
                      className={styles.accionBtn}
                      onClick={() => resetear(persona)}
                      disabled={cargando}
                    >
                      Resetear PIN
                    </button>
                    <button
                      type="button"
                      className={styles.accionBtn}
                      onClick={() => alternarEstado(persona)}
                      disabled={cargando}
                    >
                      {persona.activo ? 'Desactivar' : 'Activar'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
