<script lang="tsx">
/** @jsxImportSource vue */
import { defineComponent } from "vue";

export default defineComponent({
  setup(_props) {
    return () => (
      <form>
        <div class="form-field">
          <label for="numbers">Numbers</label>
          <select-enhancer>
            <combobox-field id="numbers" name="numbers" valueis="anyvalue" onFilterchange={(e) => e} />
            <combobox-listbox>
              <combobox-option value="1">One</combobox-option>
              <combobox-option value="2">Two</combobox-option>
              <combobox-option value="3">Three</combobox-option>
            </combobox-listbox>
          </select-enhancer>
        </div>
      </form>
    );
  },
});
</script>
