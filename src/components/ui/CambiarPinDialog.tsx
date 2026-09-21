'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useRouter } from 'next/navigation';
import { cambiarPinPropio } from '@/app/actions/auth';
import { PinPad } from './PinPad';
import { toast } from './Toast';
import styles from './CancelOrderDialog.module.css';

interface CambiarPinDialogProps {
  isOpen: boolean;
  nombre: string;
  onClose: () => void;
}

type Paso = 'actual' | 'nuevo' | 'repetir';

/**
 * Cambiar el PIN propio desde cualquier pantalla, en tres toques de teclado:
 * el actual, el nuevo y repetirlo.
 *
 * Existe porque el PIN se marca en una tablet que pasa de mano en mano y
 * alguien puede verlo por encima del hombro. Cuando pasa, la persona lo
 * cambia en el momento — sin pasar por administración ni esperar un reseteo.
 * Al guardarlo, las sesiones de esa persona en OTRAS tablets se cierran.
 *
 * Reutiliza los estilos del diálogo de anulación para verse igual en
 * celular y tablet.
 */
export const CambiarPinDialog: React.FC<CambiarPinDialogProps> = ({ isOpen, nombre, onClose }) => {
  const router = useRouter();
  const [paso, setPaso] = useState<Paso>('actual');
  const [pin, setPin] = useState('');
  const [pinActual, setPinActual] = useState('');
  const [pinNuevo, setPinNuevo] = useState('');
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);

  // Al abrirse, siempre en blanco (patrón: ajuste durante el render)
  const [estabaAbierto, setEstabaAbierto] = useState(isOpen);
  if (isOpen !== estabaAbierto) {
    setEstabaAbierto(isOpen);
    if (isOpen) {
      setPaso('actual');
      setPin('');
      setPinActual('');
      setPinNuevo('');
      setError('');
      setGuardando(false);
    }
  }

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !guardando) onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, guardando, onClose]);

  if (!isOpen || typeof document === 'undefined') return null;

  const alCompletar = async (valor: string) => {
    setError('');

    if (paso === 'actual') {
      setPinActual(valor);
      setPin('');
      setPaso('nuevo');
      return;
    }

    if (paso === 'nuevo') {
      if (valor === pinActual) {
        setError('El PIN nuevo tiene que ser distinto al actual.');
        setPin('');
        return;
      }
      setPinNuevo(valor);
      setPin('');
      setPaso('repetir');
      return;
    }

    // repetir
    if (valor !== pinNuevo) {
      setError('Los dos PIN no coinciden. Escribe el nuevo otra vez.');
      setPin('');
      setPaso('nuevo');
      return;
    }

    setGuardando(true);
    const res = await cambiarPinPropio(pinActual, valor);
    setGuardando(false);

    if (!res.success) {
      // Casi siempre es el PIN actual mal marcado: se vuelve a ese paso
      setError(res.error);
      setPin('');
      setPinActual('');
      setPinNuevo('');
      setPaso('actual');
      return;
    }

    if (res.reingresar) {
      toast.success('PIN cambiado. Entra de nuevo con el nuevo PIN.');
      onClose();
      router.push('/login');
      router.refresh();
      return;
    }

    toast.success('PIN cambiado. Si tenías sesión en otra tablet, se cerró.');
    onClose();
    router.refresh();
  };

  const titulo =
    paso === 'actual' ? 'Marca tu PIN actual' : paso === 'nuevo' ? 'Elige tu PIN nuevo' : 'Repite el PIN nuevo';
  const ayuda =
    paso === 'actual'
      ? `${nombre}, primero el PIN con el que entras hoy.`
      : paso === 'nuevo'
        ? 'Cuatro números que solo tú sepas. Nada obvio como 1111 o 1234.'
        : 'Márcalo otra vez para confirmar.';

  return createPortal(
    <div
      className={styles.backdrop}
      onClick={() => {
        if (!guardando) onClose();
      }}
    >
      <div className={styles.dialog} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>{titulo}</h3>
        <p className={styles.subtitle}>{ayuda}</p>

        {error && <div className={styles.errorPin}>{error}</div>}

        <PinPad valor={pin} onChange={setPin} onCompleto={alCompletar} disabled={guardando} />

        <div className={styles.actions}>
          <button type="button" className={styles.volverBtn} onClick={onClose} disabled={guardando}>
            Cancelar
          </button>
          {paso !== 'actual' && (
            <button
              type="button"
              className={styles.volverBtn}
              onClick={() => {
                setPaso('actual');
                setPin('');
                setPinActual('');
                setPinNuevo('');
                setError('');
              }}
              disabled={guardando}
            >
              Empezar de nuevo
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};
