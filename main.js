// ==========================================
// REFERENCIAS A ELEMENTOS DEL DOM
// ==========================================
const formSerie = document.getElementById('form-serie');
const gridSeries = document.getElementById('grid-series');
const inputId = document.getElementById('serie-id'); // Campo oculto para edición
const btnSubmit = formSerie.querySelector('button[type="submit"]');
const tituloForm = document.querySelector('.card-form h2');

// ==========================================
// SECCIÓN 1: INICIALIZACIÓN
// Escuchamos cuando la página termina de cargar
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  cargarSeries();
});


// ==========================================
// SECCIÓN 2: LECTURA DE DATOS (READ)
// Consulta todas las series y crea las tarjetas
// ==========================================
async function cargarSeries() {
  if (!gridSeries) return;

  gridSeries.innerHTML = '<p class="subtitle">Cargando recomendaciones...</p>';

  const { data: series, error } = await supabase
    .from('series')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error("Error al cargar series:", error);
    gridSeries.innerHTML = '<p class="subtitle">Error al cargar las series.</p>';
    return;
  }

  if (!series || series.length === 0) {
    gridSeries.innerHTML = '<p class="subtitle">Aún no hay series recomendadas. ¡Sé el primero en publicar una!</p>';
    return;
  }

  gridSeries.innerHTML = '';

  series.forEach(serie => {
    const card = document.createElement('article');
    card.className = 'card-serie';

    // Usamos las clases de tu CSS (btn-action, btn-edit, btn-delete, card-actions)
    card.innerHTML = `
      <img src="${serie.imagen_url}" alt="Portada de ${serie.titulo}" onerror="this.src='https://placehold.co/300x400?text=Sin+Portada'">
      <div class="card-body">
        <div class="card-header-info">
          <span class="badge-genero">${serie.genero || 'General'}</span>
          <span class="score">★ ${serie.puntuacion || 0}</span>
        </div>
        <h3 class="card-title">${serie.titulo}</h3>
        <p class="card-resena">${serie.resena || ''}</p>
        <div class="card-footer-author">
          Recomendado por: ${serie.user_email || 'Anónimo'}
        </div>

        <!-- BOTONES DE ACCIÓN (EDITAR Y BORRAR) -->
        <div class="card-actions">
          <button class="btn-action btn-edit" onclick="prepararEdicion(${serie.id})">✏️ Editar</button>
          <button class="btn-action btn-delete" onclick="eliminarSerie(${serie.id})">🗑️ Eliminar</button>
        </div>
      </div>
    `;

    gridSeries.appendChild(card);
  });
}


// ==========================================
// SECCIÓN 3: ELIMINAR DATOS (DELETE)
// Borra una serie por su ID
// ==========================================
async function eliminarSerie(id) {
  const confirmacion = confirm("¿Estás seguro de que querés eliminar esta recomendación?");
  
  if (!confirmacion) return;

  try {
    const { error } = await supabase
      .from('series')
      .delete()
      .eq('id', id);

    if (error) {
      throw new Error("Error al eliminar: " + error.message);
    }

    alert("Serie eliminada con éxito.");
    
    // Si estábamos editando justo la serie que se eliminó, limpiamos el formulario
    if (inputId.value == id) {
      cancelarEdicion();
    }

    await cargarSeries(); // Recargamos el catálogo

  } catch (err) {
    alert(err.message);
  }
}


// ==========================================
// SECCIÓN 4: PREPARAR EDICIÓN
// Carga los datos de una tarjeta en el formulario
// ==========================================
async function prepararEdicion(id) {
  try {
    // Buscamos los datos actuales de esta serie en Supabase
    const { data: serie, error } = await supabase
      .from('series')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;

    // Llenamos el formulario con los datos recuperados
    inputId.value = serie.id;
    document.getElementById('titulo').value = serie.titulo;
    document.getElementById('genero').value = serie.genero;
    document.getElementById('puntuacion').value = serie.puntuacion;
    document.getElementById('resena').value = serie.resena;

    // En edición la foto no la marcamos como requerida (si no suben una nueva, se mantiene la anterior)
    document.getElementById('imagen-file').required = false;

    // Cambiamos el aspecto visual del formulario para avisar que es una EDICIÓN
    tituloForm.textContent = 'Editar Recomendación';
    btnSubmit.textContent = 'Guardar Cambios';

    // Desplazamos suavemente la pantalla hacia el formulario arriba
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    alert("No se pudo cargar la serie para editar: " + err.message);
  }
}


// ==========================================
// SECCIÓN 5: CREAR / ACTUALIZAR (CREATE / UPDATE)
// Maneja el envío del formulario según si hay ID o no
// ==========================================
formSerie.addEventListener('submit', async (e) => {
  e.preventDefault();

  btnSubmit.disabled = true;
  btnSubmit.textContent = 'Guardando...';

  try {
    const id = inputId.value; // Si tiene valor, es UPDATE. Si está vacío, es INSERT.
    const titulo = document.getElementById('titulo').value.trim();
    const genero = document.getElementById('genero').value;
    const puntuacion = parseFloat(document.getElementById('puntuacion').value);
    const resena = document.getElementById('resena').value.trim();

    const archivoInput = document.getElementById('imagen-file');
    const archivo = archivoInput.files[0];

    let imagenUrl = null;

    // Si seleccionaron una imagen nueva, la subimos
    if (archivo) {
      const nombreArchivo = `${Date.now()}_${archivo.name}`;

      const { data: storageData, error: storageError } = await supabase.storage
        .from('imagenes')
        .upload(nombreArchivo, archivo);

      if (storageError) {
        throw new Error("Error al subir la imagen: " + storageError.message);
      }

      const { data: urlData } = supabase.storage
        .from('imagenes')
        .getPublicUrl(nombreArchivo);

      imagenUrl = urlData.publicUrl;
    }

    // --- MODO A: ACTUALIZAR (UPDATE) ---
    if (id) {
      const datosActualizados = {
        titulo: titulo,
        genero: genero,
        puntuacion: puntuacion,
        resena: resena
      };

      // Solo actualizamos la imagen en la BD si el usuario subió una nueva
      if (imagenUrl) {
        datosActualizados.imagen_url = imagenUrl;
      }

      const { error } = await supabase
        .from('series')
        .update(datosActualizados)
        .eq('id', id);

      if (error) throw error;

      alert('¡Recomendación actualizada con éxito!');

    // --- MODO B: CREAR NUEVA (INSERT) ---
    } else {
      const nuevaSerie = {
        titulo: titulo,
        genero: genero,
        puntuacion: puntuacion,
        imagen_url: imagenUrl || 'https://placehold.co/300x400?text=Sin+Portada',
        resena: resena,
        user_email: 'alumno@escuela.edu.ar'
      };

      const { error } = await supabase
        .from('series')
        .insert([nuevaSerie]);

      if (error) throw error;

      alert('¡Serie recomendada y guardada con éxito!');
    }

    // Reseteamos el formulario y restauramos el modo normal
    cancelarEdicion();

    // Recargamos el catálogo
    await cargarSeries();

  } catch (err) {
    alert(err.message);
  } finally {
    btnSubmit.disabled = false;
  }
});


// ==========================================
// SECCIÓN 6: HELPER PARA RESTAURAR EL FORMULARIO
// Vuelve el formulario a su estado original (Modo Crear)
// ==========================================
function cancelarEdicion() {
  formSerie.reset();
  inputId.value = '';
  document.getElementById('imagen-file').required = true;
  tituloForm.textContent = 'Recomendar una Serie';
  btnSubmit.textContent = 'Publicar Recomendación';
}